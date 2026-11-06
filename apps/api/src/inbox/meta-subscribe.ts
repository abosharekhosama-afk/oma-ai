const GRAPH = 'https://graph.facebook.com';

function graphVersion() {
  return process.env.META_GRAPH_VERSION || 'v21.0';
}

/**
 * Subscribe a Facebook Page to Meta webhooks for inbox fields (best-effort after OAuth).
 */
export async function subscribeMetaPageWebhooks(
  pageExternalId: string,
  pageAccessToken: string,
): Promise<void> {
  const v = graphVersion();
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

/** Subscribe a WhatsApp Business Account so Cloud API messages reach /api/webhooks/meta. */
export async function subscribeWhatsAppWaba(wabaId: string, accessToken: string): Promise<void> {
  const v = graphVersion();
  const url = `${GRAPH}/${v}/${encodeURIComponent(wabaId)}/subscribed_apps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: '{}',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[inbox] WhatsApp WABA subscribe failed for ${wabaId}: ${body.slice(0, 200)}`);
  }
}
