import { getPrisma } from '@oma/db';
import { newId, workDriveMasterConfig, WorkDriveClient, type FetchLike } from '@oma/domain';

export type OrphanTickDeps = {
  now?: () => Date;
  fetchImpl?: FetchLike;
  masterConfig?: typeof workDriveMasterConfig;
  dryRun?: boolean;
  graceMs?: number;
  maxFiles?: number;
};

function orphanConfig(env: NodeJS.ProcessEnv = process.env) {
  const num = (key: string, fallback: number) => {
    const n = Number(env[key]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const dryDefault = env.NODE_ENV === 'production' ? '0' : '1';
  return {
    graceMs: num('STORAGE_ORPHAN_GRACE_DAYS', 7) * 24 * 60 * 60_000,
    dryRun: (env.STORAGE_ORPHAN_DRY_RUN ?? dryDefault) !== '0',
    maxFiles: num('STORAGE_ORPHAN_MAX_FILES', 500),
  };
}

type Listed = { id: string; folderId: string; name: string; updatedAt: Date | null; path: string };

async function walk(
  client: WorkDriveClient,
  folderId: string,
  prefix: string[],
  acc: Listed[],
  limit: number,
) {
  if (acc.length >= limit) return;
  const folder = await client.getFolder(folderId);
  for (const file of folder.files) {
    acc.push({
      id: file.id,
      folderId,
      name: file.name,
      updatedAt: file.updatedAt ? new Date(file.updatedAt) : null,
      path: [...prefix, file.name].join('/'),
    });
    if (acc.length >= limit) return;
  }
  for (const child of folder.folders) {
    if (child.name === '..' || child.name.includes('/') || child.name.includes('\\')) continue;
    await walk(client, child.id, [...prefix, child.name], acc, limit);
    if (acc.length >= limit) return;
  }
}

export async function runOrphanCleanupTick(deps: OrphanTickDeps = {}) {
  const cfg = orphanConfig();
  const now = deps.now?.() ?? new Date();
  const dryRun = deps.dryRun ?? cfg.dryRun;
  const graceMs = deps.graceMs ?? cfg.graceMs;
  const maxFiles = deps.maxFiles ?? cfg.maxFiles;
  const out = {
    scanned: 0,
    marked_missing: 0,
    orphans_seen: 0,
    trashed: 0,
    skipped_young: 0,
    skipped_outside: 0,
    dry_run: dryRun,
  };
  const masterCfg = (deps.masterConfig ?? workDriveMasterConfig)();
  if (!masterCfg) return out;
  const master = new WorkDriveClient(masterCfg.baseUrl, masterCfg.apiKey, deps.fetchImpl);
  const prisma = getPrisma();

  let tenantsFolderId: string | null = null;
  try {
    const self = await master.self();
    const rootId = self.rootFolder?.id;
    if (rootId) {
      const root = await master.getFolder(rootId);
      tenantsFolderId = root.folders.find((f) => f.name === 'tenants')?.id ?? null;
    }
  } catch {
    tenantsFolderId = null;
  }

  const listed: Listed[] = [];
  if (tenantsFolderId) {
    await walk(master, tenantsFolderId, ['tenants'], listed, maxFiles);
  }

  const byTenant = new Map<string, Listed[]>();
  for (const file of listed) {
    const parts = file.path.split('/');
    if (parts[0] !== 'tenants' || !parts[1]) {
      out.skipped_outside++;
      continue;
    }
    const tenantId = parts[1]!;
    const group = byTenant.get(tenantId) ?? [];
    group.push(file);
    byTenant.set(tenantId, group);
  }

  const tenantIds = [...byTenant.keys()];
  const knownTenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true },
      })
    : [];
  const known = new Set(knownTenants.map((t) => t.id));

  for (const tenantId of tenantIds) {
    if (!known.has(tenantId)) {
      out.skipped_outside += byTenant.get(tenantId)?.length ?? 0;
      continue;
    }
    const remote = byTenant.get(tenantId) ?? [];
    out.scanned += remote.length;
    const assets = await prisma.mediaAsset.findMany({
      where: { tenantId, storageProvider: 'OMA_INTERNAL' },
      select: { id: true, workdriveFileId: true, status: true },
    });
    const byFile = new Map(assets.map((a) => [a.workdriveFileId, a]));
    const remoteIds = new Set(remote.map((f) => f.id));

    for (const asset of assets) {
      if (remoteIds.has(asset.workdriveFileId)) continue;
      try {
        await master.details(asset.workdriveFileId);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'not_found' && asset.status !== 'MISSING') {
          await prisma.mediaAsset.update({
            where: { id: asset.id },
            data: { status: 'MISSING', missingSince: now, lastCheckedAt: now },
          });
          out.marked_missing++;
        }
      }
    }

    for (const file of remote) {
      if (byFile.has(file.id)) continue;
      out.orphans_seen++;
      const age = file.updatedAt ? now.getTime() - file.updatedAt.getTime() : graceMs + 1;
      if (age < graceMs) {
        out.skipped_young++;
        continue;
      }
      if (dryRun) continue;
      try {
        await master.trash(file.id);
        out.trashed++;
      } catch {
        /* best effort */
      }
    }
  }

  if (!tenantsFolderId) {
    const assets = await prisma.mediaAsset.findMany({
      where: { storageProvider: 'OMA_INTERNAL', status: { not: 'MISSING' } },
      select: { id: true, workdriveFileId: true, status: true },
      take: maxFiles,
    });
    out.scanned += assets.length;
    for (const asset of assets) {
      try {
        await master.details(asset.workdriveFileId);
      } catch (e) {
        if ((e as { code?: string }).code === 'not_found') {
          await prisma.mediaAsset.update({
            where: { id: asset.id },
            data: { status: 'MISSING', missingSince: now, lastCheckedAt: now },
          });
          out.marked_missing++;
        }
      }
    }
  }

  await prisma.auditEvent.create({
    data: {
      id: newId(),
      actorUserId: null,
      actorType: 'SYSTEM',
      tenantId: null,
      action: 'storage.orphan_cleanup',
      targetType: 'StorageQuotaReconcile',
      targetId: 'orphan',
      afterRef: JSON.stringify(out).slice(0, 500),
    },
  });
  return out;
}
