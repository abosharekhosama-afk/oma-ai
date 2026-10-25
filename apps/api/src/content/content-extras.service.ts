import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { ContentService } from './content.service';

@Injectable()
export class ContentExtrasService {
  constructor(
    private readonly audit: AuditService,
    private readonly content: ContentService,
  ) {}

  private async requireBrand(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) {
      throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    }
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand is archived', 409, 'error.brand_archived');
    }
    return brand;
  }

  async listDayNotes(tenantId: string, brandId: string, from?: string, to?: string) {
    await this.requireBrand(tenantId, brandId);
    const where: Record<string, unknown> = { tenantId, brandId };
    if (from || to) {
      where.dayKey = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    const rows = await getPrisma().calendarDayNote.findMany({
      where,
      orderBy: { dayKey: 'asc' },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        brand_id: r.brandId,
        day_key: r.dayKey,
        text: { en: r.textEn, ar: r.textAr },
        color: r.color,
        locked: r.locked,
        updated_at: r.updatedAt.toISOString(),
      })),
    };
  }

  async upsertDayNote(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      dayKey: string;
      text?: { en?: string; ar?: string } | string;
      color?: string;
      locked?: boolean;
    },
  ) {
    await this.requireBrand(tenantId, brandId);
    const dayKey = (input.dayKey ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid dayKey', 400, 'errors.validation_failed');
    }
    let textEn = '';
    let textAr = '';
    if (typeof input.text === 'string') {
      textEn = input.text;
      textAr = input.text;
    } else if (input.text) {
      textEn = input.text.en ?? '';
      textAr = input.text.ar ?? input.text.en ?? '';
    }
    const existing = await getPrisma().calendarDayNote.findUnique({
      where: { brandId_dayKey: { brandId, dayKey } },
    });
    if (existing?.locked && input.text !== undefined && input.locked !== false) {
      throw new DomainError('CONFLICT_STATE', 'Note is locked', 409, 'error.conflict_state');
    }
    const row = await getPrisma().calendarDayNote.upsert({
      where: { brandId_dayKey: { brandId, dayKey } },
      create: {
        id: newId(),
        tenantId,
        brandId,
        dayKey,
        textEn,
        textAr,
        color: input.color ?? 'yellow',
        locked: input.locked ?? false,
        createdBy: actorUserId,
      },
      update: {
        ...(input.text !== undefined ? { textEn, textAr } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.locked !== undefined ? { locked: input.locked } : {}),
      },
    });
    return {
      data: {
        id: row.id,
        brand_id: row.brandId,
        day_key: row.dayKey,
        text: { en: row.textEn, ar: row.textAr },
        color: row.color,
        locked: row.locked,
        updated_at: row.updatedAt.toISOString(),
      },
    };
  }

  async deleteDayNote(tenantId: string, brandId: string, dayKey: string) {
    const row = await getPrisma().calendarDayNote.findFirst({
      where: tenantWhere(tenantId, { brandId, dayKey }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Note not found', 404, 'errors.not_found');
    if (row.locked) {
      throw new DomainError('CONFLICT_STATE', 'Note is locked', 409, 'error.conflict_state');
    }
    await getPrisma().calendarDayNote.delete({ where: { id: row.id } });
    return { data: { ok: true } };
  }

  async listLabels(tenantId: string, brandId: string) {
    const rows = await getPrisma().contentLabel.findMany({
      where: tenantWhere(tenantId, { brandId }),
      orderBy: { nameEn: 'asc' },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        brand_id: r.brandId,
        name: { en: r.nameEn, ar: r.nameAr },
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        color: r.color,
      })),
    };
  }

  async createLabel(
    tenantId: string,
    brandId: string,
    input: {
      name?: { en?: string; ar?: string } | string | null;
      nameEn?: string;
      nameAr?: string;
      color?: string;
    },
  ) {
    await this.requireBrand(tenantId, brandId);
    // Accept `name` (string | {en, ar}) or flat `nameEn`/`nameAr`; malformed input is a 400, never a 500.
    const raw = input ?? {};
    const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const nameEn =
      typeof raw.name === 'string'
        ? pick(raw.name)
        : pick(raw.name?.en) || pick(raw.nameEn);
    const nameAr =
      (typeof raw.name === 'string' ? '' : pick(raw.name?.ar)) || pick(raw.nameAr) || nameEn;
    if (!nameEn) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Label name required',
        400,
        'errors.validation_failed',
      );
    }
    const row = await getPrisma().contentLabel.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        nameEn,
        nameAr,
        color:
          typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color)
            ? raw.color
            : '#6366f1',
      },
    });
    return {
      data: {
        id: row.id,
        brand_id: row.brandId,
        name: { en: row.nameEn, ar: row.nameAr },
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        color: row.color,
      },
    };
  }

  async deleteLabel(tenantId: string, brandId: string, labelId: string) {
    const row = await getPrisma().contentLabel.findFirst({
      where: tenantWhere(tenantId, { id: labelId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Label not found', 404, 'errors.not_found');
    await getPrisma().contentLabel.delete({ where: { id: labelId } });
    return { data: { ok: true } };
  }

  async setContentLabels(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    labels: string[],
  ) {
    return this.content.update(tenantId, actorUserId, contentId, {
      labels: labels.map((l) => l.trim()).filter(Boolean),
    });
  }

  async setClientVisible(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    clientVisible: boolean,
  ) {
    return this.content.update(tenantId, actorUserId, contentId, { clientVisible });
  }

  async listTemplates(tenantId: string, brandId: string) {
    const rows = await getPrisma().contentTemplate.findMany({
      where: tenantWhere(tenantId, { brandId }),
      orderBy: { updatedAt: 'desc' },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        brand_id: r.brandId,
        name: { en: r.nameEn, ar: r.nameAr },
        title: r.titleEn || r.titleAr ? { en: r.titleEn ?? '', ar: r.titleAr ?? '' } : null,
        caption:
          r.captionEn || r.captionAr ? { en: r.captionEn ?? '', ar: r.captionAr ?? '' } : null,
        content_type: r.contentType,
        channel: r.channel,
        track: r.track,
        labels: r.labels,
        preview_asset_url: r.previewAssetUrl,
        updated_at: r.updatedAt.toISOString(),
      })),
    };
  }

  async createTemplate(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      name: { en: string; ar?: string } | string;
      fromContentId?: string;
      contentType?: string;
      channel?: string;
      track?: string;
      labels?: string[];
    },
  ) {
    await this.requireBrand(tenantId, brandId);
    let titleEn: string | null = null;
    let titleAr: string | null = null;
    let captionEn: string | null = null;
    let captionAr: string | null = null;
    let contentType = input.contentType ?? 'POST';
    let channel = input.channel ?? 'instagram';
    let track = input.track ?? 'ORGANIC';
    let labels = input.labels ?? [];
    let previewAssetUrl: string | null = null;

    if (input.fromContentId) {
      const src = await getPrisma().contentItem.findFirst({
        where: tenantWhere(tenantId, { id: input.fromContentId, brandId }),
      });
      if (src) {
        titleEn = src.titleEn;
        titleAr = src.titleAr;
        captionEn = src.captionEn;
        captionAr = src.captionAr;
        contentType = src.contentType;
        channel = src.channel;
        track = src.track;
        labels = src.labels;
        previewAssetUrl = src.previewAssetUrl;
      }
    }
    const nameEn = typeof input.name === 'string' ? input.name.trim() : input.name.en.trim();
    const nameAr =
      typeof input.name === 'string' ? input.name.trim() : (input.name.ar ?? input.name.en).trim();
    if (!nameEn) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Template name required',
        400,
        'errors.validation_failed',
      );
    }
    const row = await getPrisma().contentTemplate.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        nameEn,
        nameAr,
        titleEn,
        titleAr,
        captionEn,
        captionAr,
        contentType: contentType as never,
        channel,
        track: track as never,
        labels,
        previewAssetUrl,
        createdBy: actorUserId,
      },
    });
    return {
      data: {
        id: row.id,
        brand_id: row.brandId,
        name: { en: row.nameEn, ar: row.nameAr },
        title: row.titleEn || row.titleAr ? { en: row.titleEn ?? '', ar: row.titleAr ?? '' } : null,
        caption:
          row.captionEn || row.captionAr
            ? { en: row.captionEn ?? '', ar: row.captionAr ?? '' }
            : null,
        content_type: row.contentType,
        channel: row.channel,
        track: row.track,
        labels: row.labels,
        preview_asset_url: row.previewAssetUrl,
        updated_at: row.updatedAt.toISOString(),
      },
    };
  }

  async deleteTemplate(tenantId: string, brandId: string, templateId: string) {
    const row = await getPrisma().contentTemplate.findFirst({
      where: tenantWhere(tenantId, { id: templateId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Template not found', 404, 'errors.not_found');
    await getPrisma().contentTemplate.delete({ where: { id: templateId } });
    return { data: { ok: true } };
  }

  async createFromTemplate(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    templateId: string,
    overrides?: { campaignId?: string | null; plannedAt?: string | null },
  ) {
    const tpl = await getPrisma().contentTemplate.findFirst({
      where: tenantWhere(tenantId, { id: templateId, brandId }),
    });
    if (!tpl) throw new DomainError('NOT_FOUND', 'Template not found', 404, 'errors.not_found');
    return this.content.create(tenantId, actorUserId, brandId, {
      title: { en: tpl.titleEn || tpl.nameEn, ar: tpl.titleAr || tpl.nameAr },
      caption:
        tpl.captionEn || tpl.captionAr
          ? { en: tpl.captionEn ?? '', ar: tpl.captionAr ?? '' }
          : undefined,
      campaignId: overrides?.campaignId ?? null,
      contentType: tpl.contentType as never,
      channel: tpl.channel,
      track: tpl.track as never,
      plannedAt: overrides?.plannedAt ?? null,
      labels: tpl.labels,
    });
  }
}
