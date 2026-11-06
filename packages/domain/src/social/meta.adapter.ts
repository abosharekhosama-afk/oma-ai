import { publishMediaUrls } from '../time/publish-media';
import {
  httpError,
  readJson,
  SocialProviderError,
  type ConnectedAccount,
  type FetchLike,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

const GRAPH = 'https://graph.facebook.com';

type Env = { META_APP_ID?: string; META_APP_SECRET?: string; META_GRAPH_VERSION?: string };

/**
 * Meta Graph API: Facebook Pages (pages_manage_posts) and Instagram professional accounts
 * linked to those pages (instagram_content_publish). Docs:
 * https://developers.facebook.com/docs/pages-api/posts ,
 * https://developers.facebook.com/docs/instagram-platform/content-publishing
 */
export class MetaAdapter implements SocialProviderAdapter {
  readonly requiredEnv = ['META_APP_ID', 'META_APP_SECRET'] as const;
  readonly usesPkce = false;
  constructor(
    readonly network: 'facebook' | 'instagram',
    private readonly env: Env = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  private get v() {
    return this.env.META_GRAPH_VERSION || 'v21.0';
  }

  isConfigured() {
    return Boolean(this.env.META_APP_ID && this.env.META_APP_SECRET);
  }

  private scopes() {
    return this.network === 'facebook'
      ? [
          'pages_show_list',
          'pages_read_engagement',
          'pages_manage_posts',
          'pages_messaging',
          'pages_manage_metadata',
        ]
      : [
          'pages_show_list',
          'pages_read_engagement',
          'business_management',
          'instagram_basic',
          'instagram_content_publish',
          'instagram_manage_comments',
          'instagram_manage_messages',
        ];
  }

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
    const q = new URLSearchParams({
      client_id: this.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: this.scopes().join(','),
    });
    return `https://www.facebook.com/${this.v}/dialog/oauth?${q}`;
  }

  private async get(path: string, params: Record<string, string>) {
    const res = await this.fetchFn(`${GRAPH}/${this.v}/${path}?${new URLSearchParams(params)}`);
    const body = await readJson(res);
    if (!res.ok) throw httpError(this.network, res, body);
    return body;
  }

  private async post(path: string, params: Record<string, string>) {
    const res = await this.fetchFn(`${GRAPH}/${this.v}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const body = await readJson(res);
    if (!res.ok) throw httpError(this.network, res, body);
    return body;
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const short = await this.get('oauth/access_token', {
      client_id: this.env.META_APP_ID!,
      client_secret: this.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    });
    // Long-lived user token → page tokens derived from it do not expire.
    const long = await this.get('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: this.env.META_APP_ID!,
      client_secret: this.env.META_APP_SECRET!,
      fb_exchange_token: String(short.access_token),
    });
    const pages = await this.get('me/accounts', {
      access_token: String(long.access_token),
      fields:
        'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}',
      limit: '100',
    });
    const rows = (pages.data as Array<Record<string, unknown>> | undefined) ?? [];
    const out: ConnectedAccount[] = [];
    for (const p of rows) {
      const pageToken: TokenSet = {
        accessToken: String(p.access_token),
        expiresAt: null,
        scopes: this.scopes(),
      };
      if (this.network === 'facebook') {
        out.push({
          externalId: String(p.id),
          name: String(p.name),
          avatarUrl: ((p.picture as { data?: { url?: string } })?.data?.url as string) ?? null,
          token: pageToken,
          meta: { page_id: String(p.id) },
        });
      } else {
        const ig = p.instagram_business_account as Record<string, unknown> | undefined;
        if (!ig?.id) continue;
        out.push({
          externalId: String(ig.id),
          name: String(ig.username ?? ig.name ?? p.name),
          avatarUrl: (ig.profile_picture_url as string) ?? null,
          token: pageToken,
          meta: { page_id: String(p.id), username: ig.username ?? null },
        });
      }
    }
    return out;
  }

  /** Page tokens are long-lived; validate it still works (revoked → reauth). */
  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    await this.get(page.externalId, { fields: 'id', access_token: page.accessToken });
    return null;
  }

  async publish(page: PublishablePage, post: PublishInput): Promise<PublishResult> {
    const media = publishMediaUrls(post);
    if (this.network === 'facebook') {
      const primary = media[0];
      if (!primary) {
        const r = await this.post(`${page.externalId}/feed`, {
          message: post.text,
          access_token: page.accessToken,
        });
        const id = String(r.post_id ?? r.id);
        return { externalId: id, url: `https://www.facebook.com/${id}` };
      }
      const metaList = post.media ?? [];
      const primaryMime = metaList.find((m) => m.url === primary)?.mime ?? '';
      const type = String(post.contentType || '').toUpperCase();
      const isStory = type === 'STORY';
      if (isStory) {
        if (media.length > 1) {
          throw new SocialProviderError(
            'facebook: Page stories support a single image or video asset.',
            { retryable: false },
          );
        }
        return await this.publishFacebookStory(page, primary, primaryMime, post.text);
      }
      return await this.publishFacebookFeedMedia(page, primary, primaryMime, type, post.text);
    }
    if (!media.length) {
      throw new SocialProviderError('instagram: an image is required to publish', {
        retryable: false,
      });
    }
    let creationId: string;
    if (media.length === 1) {
      const type = String(post.contentType || '').toUpperCase();
      const isReel = type === 'REEL' || type === 'VIDEO';
      const isStory = type === 'STORY';
      const container = await this.post(`${page.externalId}/media`, {
        ...(isReel || isStory
          ? {
              media_type: isStory ? 'STORIES' : 'REELS',
              video_url: media[0]!,
            }
          : { image_url: media[0]! }),
        caption: post.text,
        access_token: page.accessToken,
      });
      creationId = String(container.id);
    } else {
      const childIds: string[] = [];
      for (const url of media) {
        const child = await this.post(`${page.externalId}/media`, {
          image_url: url,
          is_carousel_item: 'true',
          access_token: page.accessToken,
        });
        childIds.push(String(child.id));
      }
      const carousel = await this.post(`${page.externalId}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: post.text,
        access_token: page.accessToken,
      });
      creationId = String(carousel.id);
    }
    const published = await this.post(`${page.externalId}/media_publish`, {
      creation_id: creationId,
      access_token: page.accessToken,
    });
    const id = String(published.id);
    if (!id) {
      throw new SocialProviderError('instagram: publish returned no media id', { retryable: true });
    }
    let url: string | null = null;
    try {
      const info = await this.get(id, { fields: 'permalink', access_token: page.accessToken });
      url = (info.permalink as string) ?? null;
    } catch {
      url = null;
    }
    return { externalId: id, url };
  }

  /** Facebook Page feed: photo vs video uses different Graph edges; `/photos` rejects video URLs (error 100). */
  private looksLikeVideo(mime: string, url: string): boolean {
    const m = mime.toLowerCase();
    if (m.startsWith('video/')) return true;
    if (/\.(mp4|mov|m4v|webm)(\?|$)/i.test(url)) return true;
    return false;
  }

  private async publishFacebookFeedMedia(
    page: PublishablePage,
    primaryUrl: string,
    primaryMime: string,
    contentType: string,
    caption: string,
  ): Promise<PublishResult> {
    const videoish =
      this.looksLikeVideo(primaryMime, primaryUrl) ||
      contentType === 'REEL' ||
      contentType === 'VIDEO';
    const r = videoish
      ? await this.post(`${page.externalId}/videos`, {
          file_url: primaryUrl,
          description: caption,
          access_token: page.accessToken,
        })
      : await this.post(`${page.externalId}/photos`, {
          url: primaryUrl,
          caption,
          access_token: page.accessToken,
        });
    const id = String(r.post_id ?? r.id);
    return { externalId: id, url: `https://www.facebook.com/${id}` };
  }

  /**
   * Facebook Page Story (not feed). Photo: unpublished upload → photo_stories. Video: video_stories start → rupload → finish.
   * @see https://developers.facebook.com/documentation/video-api/page-stories-api
   */
  private async publishFacebookStory(
    page: PublishablePage,
    mediaUrl: string,
    mime: string,
    _caption: string,
  ): Promise<PublishResult> {
    const video = this.looksLikeVideo(mime, mediaUrl);
    if (!video) {
      const uploaded = await this.post(`${page.externalId}/photos`, {
        url: mediaUrl,
        published: 'false',
        access_token: page.accessToken,
      });
      const photoId = String(uploaded.id ?? '');
      if (!photoId) {
        throw new SocialProviderError('facebook: photo upload for story returned no id', {
          retryable: true,
        });
      }
      const story = await this.post(`${page.externalId}/photo_stories`, {
        photo_id: photoId,
        access_token: page.accessToken,
      });
      const postId = String(story.post_id ?? story.id);
      if (!postId) {
        throw new SocialProviderError('facebook: photo_stories returned no post id', {
          retryable: true,
        });
      }
      return { externalId: postId, url: `https://www.facebook.com/${postId}` };
    }

    const start = await this.post(`${page.externalId}/video_stories`, {
      upload_phase: 'start',
      access_token: page.accessToken,
    });
    const videoId = String(start.video_id ?? '');
    const uploadUrl = String(start.upload_url ?? '');
    if (!videoId || !uploadUrl) {
      throw new SocialProviderError('facebook: video_stories start missing video_id or upload_url', {
        retryable: true,
      });
    }
    const up = await this.fetchFn(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${page.accessToken}`,
        file_url: mediaUrl,
      },
    });
    const upBody = await readJson(up);
    if (!up.ok) throw httpError(this.network, up, upBody);

    const finish = await this.post(`${page.externalId}/video_stories`, {
      upload_phase: 'finish',
      video_id: videoId,
      access_token: page.accessToken,
    });
    const postId = String(finish.post_id ?? finish.id);
    if (!postId) {
      throw new SocialProviderError('facebook: video_stories finish returned no post id', {
        retryable: true,
      });
    }
    return { externalId: postId, url: `https://www.facebook.com/${postId}` };
  }
}
