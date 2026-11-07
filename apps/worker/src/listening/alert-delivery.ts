import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { createMailAdapter } from '../mail/create-mail-adapter';
import type IORedis from 'ioredis';

const log = createLogger('listening-alert-delivery');

const webOrigin = () => (process.env.WEB_ORIGIN || 'http://127.0.0.1:3000').replace(/\/$/, '');

export type FiredListeningAlert = {
  alertId: string;
  alertName: string;
  triggerType: string;
  firesWhen: string;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifySlack: boolean;
};

async function contentReaders(tenantId: string) {
  const rows = await getPrisma().membership.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      grants: { some: { revokedAt: null, capabilityCode: 'content.read' } },
    },
    include: { user: { select: { id: true, email: true, preferredLocale: true } } },
  });
  return rows.map((m) => m.user).filter((u): u is NonNullable<typeof u> => Boolean(u?.id));
}

export async function deliverListeningAlertNotifications(
  tenantId: string,
  fired: FiredListeningAlert,
  dayKey: string,
  connection?: IORedis,
) {
  const deepLink = '/app/listening/alerts';
  const title = `Listening alert: ${fired.alertName}`;

  if (fired.notifyInApp) {
    const users = await contentReaders(tenantId);
    if (users.length) {
      await getPrisma().notification.createMany({
        data: users.map((u) => ({
          id: newId(),
          tenantId,
          recipientUserId: u.id,
          type: 'listening.alert_fired',
          objectType: 'ListeningAlert',
          objectId: fired.alertId,
          deepLinkPath: deepLink,
          dedupeKey: `listening.alert:${fired.alertId}:${u.id}:${dayKey}`,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (fired.notifyEmail) {
    const users = await contentReaders(tenantId);
    const mail = connection ? createMailAdapter(connection) : null;
    const text = `${fired.firesWhen}\n\nOpen: ${webOrigin()}${deepLink}`;
    const subject = title;
    for (const u of users) {
      if (!u.email) continue;
      try {
        if (mail) {
          await mail.send({ to: u.email, subject, text });
        } else {
          log.info({ to: u.email, subject }, 'listening alert email (no redis mail adapter)');
        }
      } catch (e) {
        log.error({ err: String(e), to: u.email }, 'listening alert email failed');
      }
    }
  }

  if (fired.notifySlack) {
    const ws = await getPrisma().workspaceSetting.findUnique({
      where: { tenantId },
      select: { listeningSlackWebhookUrl: true },
    });
    const hook =
      ws?.listeningSlackWebhookUrl?.trim() || process.env.LISTENING_SLACK_WEBHOOK_URL?.trim();
    if (!hook) {
      log.info({ tenantId }, 'listening slack skipped: no webhook');
      return;
    }
    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `*${title}*\n${fired.firesWhen}\n<${webOrigin()}${deepLink}|Open alerts>`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      log.error({ err: String(e) }, 'listening slack webhook failed');
    }
  }
}
