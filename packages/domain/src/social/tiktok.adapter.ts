import { publishMediaUrls } from '../time/publish-media';
import {
  expiresIn,
  httpError,
  readJson,
  SocialProviderError,
  type FetchLike,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type PublishStatusResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

type Env = {
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_PRIVACY_LEVEL?: string;
  TIKTOK_ENABLE_DIRECT_POST?: string;
  TIKTOK_BRAND_CONTENT_TOGGLE?: string;
  TIKTOK_BRAND_ORGANIC_TOGGLE?: string;
};
const API = 'https://open.tiktokapis.com';
const PHOTO_MIMES = new Set(['image/jpeg', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_PHOTO_BYTES = 20_000_000;
const MAX_VIDEO_BYTES = 4_000_000_000;
const MAX_PHOTOS = 35;

const FAIL_REASON_DETAILS: Record<string, { message: string; retryable: boolean }> = {
  file_format_check_failed: {
    message:
      'Unsupported media format or video codec. Use JPEG/WebP photos or MP4/WebM/MOV video with a supported codec.',
    retryable: false,
  },
  duration_check_failed: {
    message: 'Video duration exceeds the limit for this TikTok creator account.',
    retryable: false,
  },
  frame_rate_check_failed: {
    message: 'Video frame rate must be between 23 and 60 FPS.',
    retryable: false,
  },
  picture_size_check_failed: {
    message: 'Photo dimensions exceed TikTok limits. Photos must be at most 1080p.',
    retryable: false,
  },
  video_pull_failed: {
    message:
      'TikTok could not download the video. Check that its public URL is reachable and not bandwidth-limited.',
    retryable: true,
  },
  photo_pull_failed: {
    message:
      'TikTok could not download the photo. Check that its public URL is reachable and not bandwidth-limited.',
    retryable: true,
  },
  internal: { message: 'TikTok reported an internal processing error.', retryable: true },
  spam_risk_too_many_posts: {
    message: 'TikTok reached the creator account daily posting limit.',
    retryable: false,
  },
  spam_risk_user_banned_from_posting: {
    message: 'TikTok has restricted this creator account from posting.',
    retryable: false,
  },
  spam_risk_text: {
    message: 'TikTok rejected the post description as risky or spam-like.',
    retryable: false,
  },
  spam_risk: { message: 'TikTok rejected this publishing request as risky.', retryable: false },
  auth_removed: {
    message: 'The creator removed this app’s TikTok authorization while publishing.',
    retryable: false,
  },
};

function inferMime(url: string): string {
  try {
    const outer = new URL(url);
    const source = outer.searchParams.get('url') ?? url;
    const path = new URL(source).pathname.toLowerCase();
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.mp4')) return 'video/mp4';
    if (path.endsWith('.webm')) return 'video/webm';
    if (path.endsWith('.mov')) return 'video/quicktime';
  } catch {
    // Invalid URLs are handled by the provider / media proxy with an actionable error.
  }
  return 'application/octet-stream';
}

/**
 * TikTok Login Kit + Content Posting API (Direct Post, video or photo via PULL_FROM_URL).
 * PULL_FROM_URL URLs must use a domain/prefix verified in TikTok Developer settings.
 */
export class TikTokAdapter implements SocialProviderAdapter {
  readonly network = 'tiktok' as const;
  readonly requiredEnv = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'] as const;
  readonly usesPkce = false;
  constructor(
    private readonly env: Env = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.env.TIKTOK_CLIENT_KEY && this.env.TIKTOK_CLIENT_SECRET);
  }

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
    const scopes = ['user.info.basic'];
    if (this.env.TIKTOK_ENABLE_DIRECT_POST === '1') scopes.push('video.publish');
    const q = new URLSearchParams({
      client_key: this.env.TIKTOK_CLIENT_KEY!,
      response_type: 'code',
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  }

  private async token(params: Record<string, string>): Promise<TokenSet & { openId?: string }> {
    const res = await this.fetchFn(`${API}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_key: this.env.TIKTOK_CLIENT_KEY!,
        client_secret: this.env.TIKTOK_CLIENT_SECRET!,
      }).toString(),
    });
    const b = await readJson(res);
    if (!res.ok || b.error) throw httpError('tiktok', res, b);
    return {
      accessToken: String(b.access_token),
      refreshToken: (b.refresh_token as string) ?? null,
      expiresAt: expiresIn(b.expires_in),
      refreshExpiresAt: expiresIn(b.refresh_expires_in),
      scopes: typeof b.scope === 'string' ? b.scope.split(',') : [],
      openId: b.open_id as string,
    };
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const token = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const res = await this.fetchFn(`${API}/v2/user/info/?fields=open_id,display_name,avatar_url`, {
      headers: { authorization: `Bearer ${token.accessToken}` },
    });
    const b = await readJson(res);
    const err = b.error as { code?: string } | undefined;
    if (!res.ok || (err?.code && err.code !== 'ok')) throw httpError('tiktok', res, b);
    const u = ((b.data as { user?: Record<string, unknown> })?.user ?? {}) as Record<
      string,
      unknown
    >;
    const { openId, ...t } = token;
    return [
      {
        externalId: String(u.open_id ?? openId),
        name: String(u.display_name ?? 'TikTok'),
        avatarUrl: (u.avatar_url as string) ?? null,
        token: t,
        meta: { scopes: token.scopes ?? [] },
      },
    ];
  }

  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    if (!page.refreshToken) return null;
    const { openId: _o, ...t } = await this.token({
      grant_type: 'refresh_token',
      refresh_token: page.refreshToken,
    });
    return t;
  }

  private async creatorInfo(page: PublishablePage) {
    const res = await this.fetchFn(`${API}/v2/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${page.accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: '{}',
    });
    const body = await readJson(res);
    const error = body.error as { code?: string } | undefined;
    if (!res.ok || (error?.code && error.code !== 'ok')) throw httpError('tiktok', res, body);
    const data = (body.data ?? {}) as Record<string, unknown>;
    const privacyOptions = Array.isArray(data.privacy_level_options)
      ? data.privacy_level_options.filter((option): option is string => typeof option === 'string')
      : [];
    if (!privacyOptions.length) {
      throw new SocialProviderError(
        'tiktok [creator_info_missing]: TikTok returned no privacy options.',
        {
          retryable: false,
          providerCode: 'creator_info_missing',
        },
      );
    }
    return {
      privacyOptions,
      maxVideoDurationSec:
        typeof data.max_video_post_duration_sec === 'number'
          ? data.max_video_post_duration_sec
          : null,
      commentsDisabled: data.comment_disabled === true,
      duetDisabled: data.duet_disabled === true,
      stitchDisabled: data.stitch_disabled === true,
    };
  }

  async publish(page: PublishablePage, post: PublishInput): Promise<PublishResult> {
    const scopes = Array.isArray(page.meta.scopes) ? page.meta.scopes : [];
    if (!scopes.includes('video.publish')) {
      throw new SocialProviderError(
        'tiktok [scope_missing]: video.publish is not authorized for this app. Enable Direct Post after TikTok approval, then reconnect the account.',
        { retryable: false, providerCode: 'scope_missing' },
      );
    }
    const media: NonNullable<PublishInput['media']> = post.media?.length
      ? post.media
      : publishMediaUrls(post).map((url) => ({ url, mime: inferMime(url), sizeBytes: undefined }));
    if (!media.length) {
      throw new SocialProviderError('tiktok [media_missing]: attach a supported photo or video.', {
        retryable: false,
        providerCode: 'media_missing',
      });
    }
    const normalized = media.map((item) => ({
      ...item,
      mime: item.mime.toLowerCase().split(';')[0]!.trim(),
    }));
    const photos = normalized.filter((item) => PHOTO_MIMES.has(item.mime));
    const videos = normalized.filter((item) => VIDEO_MIMES.has(item.mime));
    if (photos.length + videos.length !== normalized.length) {
      const unsupported = normalized
        .filter((item) => !PHOTO_MIMES.has(item.mime) && !VIDEO_MIMES.has(item.mime))
        .map((item) => item.mime);
      throw new SocialProviderError(
        `tiktok [file_format_check_failed]: unsupported media MIME type(s): ${unsupported.join(', ')}. TikTok photos accept JPEG/WebP only; videos accept MP4, WebM, or MOV.`,
        { retryable: false, providerCode: 'file_format_check_failed' },
      );
    }
    if (photos.length && videos.length) {
      throw new SocialProviderError(
        'tiktok [invalid_media_combination]: photo and video files cannot be mixed in one TikTok post.',
        { retryable: false, providerCode: 'invalid_media_combination' },
      );
    }
    if (videos.length > 1) {
      throw new SocialProviderError(
        'tiktok [video_count_exceeded]: TikTok accepts one video per post; create a separate post for each additional video.',
        { retryable: false, providerCode: 'video_count_exceeded' },
      );
    }
    if (photos.length > MAX_PHOTOS) {
      throw new SocialProviderError(
        `tiktok [photo_count_exceeded]: TikTok accepts at most ${MAX_PHOTOS} photos per post.`,
        { retryable: false, providerCode: 'photo_count_exceeded' },
      );
    }
    for (const item of photos) {
      if (item.sizeBytes !== undefined && item.sizeBytes > MAX_PHOTO_BYTES) {
        throw new SocialProviderError(
          'tiktok [picture_size_check_failed]: each photo must be no larger than 20 MB.',
          { retryable: false, providerCode: 'picture_size_check_failed' },
        );
      }
    }
    for (const item of videos) {
      if (item.sizeBytes !== undefined && item.sizeBytes > MAX_VIDEO_BYTES) {
        throw new SocialProviderError(
          'tiktok [video_size_check_failed]: videos must be no larger than 4 GB.',
          { retryable: false, providerCode: 'video_size_check_failed' },
        );
      }
    }

    const creator = await this.creatorInfo(page);
    const privacyLevel = this.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';
    if (!creator.privacyOptions.includes(privacyLevel)) {
      throw new SocialProviderError(
        `tiktok [privacy_level_option_mismatch]: configured privacy level ${privacyLevel} is not available for this creator. Available options: ${creator.privacyOptions.join(', ')}.`,
        { retryable: false, providerCode: 'privacy_level_option_mismatch' },
      );
    }
    const isVideo = videos.length === 1;
    const endpoint = isVideo ? 'video/init/' : 'content/init/';
    const res = await this.fetchFn(`${API}/v2/post/publish/${endpoint}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${page.accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(
        isVideo
          ? {
              post_info: {
                title: post.text.slice(0, 2200),
                privacy_level: privacyLevel,
                disable_comment: creator.commentsDisabled,
                disable_duet: creator.duetDisabled,
                disable_stitch: creator.stitchDisabled,
                brand_content_toggle: this.env.TIKTOK_BRAND_CONTENT_TOGGLE === '1',
                brand_organic_toggle: this.env.TIKTOK_BRAND_ORGANIC_TOGGLE === '1',
              },
              source_info: { source: 'PULL_FROM_URL', video_url: videos[0]!.url },
            }
          : {
              post_info: {
                title: post.text.slice(0, 90),
                description: post.text.slice(0, 4000),
                privacy_level: privacyLevel,
                disable_comment: creator.commentsDisabled,
                auto_add_music: true,
                brand_content_toggle: this.env.TIKTOK_BRAND_CONTENT_TOGGLE === '1',
                brand_organic_toggle: this.env.TIKTOK_BRAND_ORGANIC_TOGGLE === '1',
              },
              source_info: {
                source: 'PULL_FROM_URL',
                photo_cover_index: 0,
                photo_images: photos.map((item) => item.url),
              },
              post_mode: 'DIRECT_POST',
              media_type: 'PHOTO',
            },
      ),
    });
    const b = await readJson(res);
    const err = b.error as { code?: string } | undefined;
    if (!res.ok || (err?.code && err.code !== 'ok')) throw httpError('tiktok', res, b);
    const publishId = String((b.data as { publish_id?: string })?.publish_id ?? '');
    if (!publishId) {
      throw new SocialProviderError(
        'tiktok [publish_id_missing]: publish init returned no publish_id',
        {
          retryable: true,
          status: res.status,
          providerCode: 'publish_id_missing',
        },
      );
    }
    const username = page.meta.username as string | undefined;
    return {
      externalId: publishId,
      url: username ? `https://www.tiktok.com/@${username}` : null,
      pending: true,
    };
  }

  async fetchPublishStatus(page: PublishablePage, publishId: string): Promise<PublishStatusResult> {
    const res = await this.fetchFn(`${API}/v2/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${page.accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const body = await readJson(res);
    const error = body.error as { code?: string } | undefined;
    if (!res.ok || (error?.code && error.code !== 'ok')) throw httpError('tiktok', res, body);
    const data = (body.data ?? {}) as Record<string, unknown>;
    const status = String(data.status ?? '');
    if (status === 'PUBLISH_COMPLETE') {
      const postIds = Array.isArray(data.publicly_available_post_id)
        ? data.publicly_available_post_id
        : Array.isArray(data.publicaly_available_post_id)
          ? data.publicaly_available_post_id
          : data.publicly_available_post_id !== undefined
            ? [data.publicly_available_post_id]
            : data.publicaly_available_post_id !== undefined
              ? [data.publicaly_available_post_id]
              : [];
      const externalId = postIds.length ? String(postIds[0]) : undefined;
      const username = page.meta.username as string | undefined;
      const url = username
        ? externalId
          ? `https://www.tiktok.com/@${username}/video/${externalId}`
          : `https://www.tiktok.com/@${username}`
        : null;
      return { status: 'PUBLISHED', ...(externalId ? { externalId } : {}), url };
    }
    if (status === 'FAILED') {
      const reason = String(data.fail_reason ?? 'unknown');
      const detail = FAIL_REASON_DETAILS[reason] ?? {
        message: 'TikTok reported a content processing failure.',
        retryable: false,
      };
      return {
        status: 'FAILED',
        retryable: detail.retryable,
        ...(reason === 'auth_removed' ? { reauth: true } : {}),
        errorMessage: `tiktok [${reason}]: ${detail.message}`,
      };
    }
    return { status: 'PENDING' };
  }
}
