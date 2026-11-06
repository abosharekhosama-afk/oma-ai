const GRAPH = 'https://graph.facebook.com';

/**
 * Subscribe a Facebook Page to Meta webhooks for inbox fields (best-effort after OAuth).
 */
export async function subscribeMetaPageWebhooks(
  pageExternalId: string,
  pageAccessToken: string,
): Promise<void> {
  const v = process.env.META_GRAPH_VERSION || 'v21.0';
  const fields = [
    'messages',
    'messaging_postbacks',
    'message_echoes',
    'feed',
    'comments',
    'mention',
  ].join(',');
  const url = `${GRAPH}/${v}/${encodeURIComponent(pageExternalId)}/subscribed_apps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      subscribed_fields: fields,
      access_token: pageAccessToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(
      `[inbox] Meta webhook subscribe failed for page ${pageExternalId}: ${body.slice(0, 200)}`,
    );
  }
}
