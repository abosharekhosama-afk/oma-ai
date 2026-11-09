import { WORKDRIVE_WEBHOOK_EVENTS, WorkDriveClient, workDriveMasterConfig } from '@oma/domain';

async function main() {
  const url = (process.env.WORKDRIVE_WEBHOOK_PUBLIC_URL ?? '').trim();
  const secret = (process.env.WORKDRIVE_WEBHOOK_SECRET ?? '').trim();
  const cfg = workDriveMasterConfig();
  if (!cfg || !url || !secret) {
    console.error(
      'WORKDRIVE_MASTER_BASE_URL, WORKDRIVE_MASTER_API_KEY, WORKDRIVE_WEBHOOK_PUBLIC_URL and WORKDRIVE_WEBHOOK_SECRET are required',
    );
    process.exit(1);
  }
  const client = new WorkDriveClient(cfg.baseUrl, cfg.apiKey);
  const registered = await client.registerWebhook({
    url,
    secret,
    events: [...WORKDRIVE_WEBHOOK_EVENTS],
  });
  console.log(JSON.stringify(registered, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
