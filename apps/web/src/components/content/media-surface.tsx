'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shared media renderer for every content/task/deliverable/review card and preview.
 *
 * Stored OMA media URLs (`/api/v1/media/:id/view`) carry no file extension, so the URL alone
 * cannot tell an image from a video. The kind is resolved in this order:
 *   1. an explicit `mime` prop (deliverables / tasks already know it),
 *   2. the URL itself (file extension, `/stream`, `data:` URLs),
 *   3. the media asset record (`GET /api/v1/media/:id`, cached and de-duplicated per asset).
 * `contentType` (REEL / STORY / …) is only a hint and never forces a `<video>` element, so a
 * story made from an image still renders, and a POST that carries a video still plays.
 * If rendering fails as one kind, the other kind is tried once before the neutral fallback.
 */

export type MediaKind = 'image' | 'video';

type MediaSurfaceProps = {
  src: string;
  /** MIME type when the caller already knows it (e.g. `video/mp4`). */
  mime?: string | null;
  /** Content type hint (REEL / STORY / POST …). Used only when nothing else is known. */
  contentType?: string;
  alt?: string;
  className?: string;
  /** Muted inline autoplay while the media is on screen (feed tiles, stories, previews). */
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  poster?: string;
};

const VIDEO_EXT = /\.(?:mp4|webm|mov|m4v|ogv|ogg|mkv)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico|heic|heif)(?:[?#]|$)/i;
const MEDIA_ROUTE = /^\/api\/v1\/media\/([^/?#]+)\/(view|stream)(?:[?#].*)?$/;

export function mediaIdFromUrl(src: string): string | null {
  return MEDIA_ROUTE.exec(src)?.[1] ?? null;
}

/** MIME stored on a deliverable version by the ops API (`asset_mime`), when present. */
export function versionMime(v: unknown): string | null {
  const m = (v as { mediaMime?: unknown } | null | undefined)?.mediaMime;
  return typeof m === 'string' && m ? m : null;
}

export function kindFromMime(mime?: string | null): MediaKind | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('image/')) return 'image';
  return null;
}

/** Kind that can be read from the URL alone, or null when the URL is opaque. */
export function kindFromUrl(src: string): MediaKind | null {
  if (!src) return null;
  if (/^data:video\//i.test(src)) return 'video';
  if (/^data:image\//i.test(src)) return 'image';
  if (VIDEO_EXT.test(src)) return 'video';
  if (IMAGE_EXT.test(src)) return 'image';
  if (MEDIA_ROUTE.exec(src)?.[2] === 'stream') return 'video';
  return null;
}

/** Video playback goes through the Range-capable OMA stream route, never the image redirect. */
export function videoUrlFor(src: string): string {
  const id = mediaIdFromUrl(src);
  return id ? `/api/v1/media/${id}/stream` : src;
}

/** Image rendering uses the stable view route (redirects to a fresh signed preview URL). */
function imageUrlFor(src: string): string {
  const id = mediaIdFromUrl(src);
  return id ? `/api/v1/media/${id}/view` : src;
}

const kindCache = new Map<string, MediaKind | null>();
const kindInflight = new Map<string, Promise<MediaKind | null>>();

/** Resolve the kind of a stored OMA media asset from its record (cached per asset id). */
export function resolveMediaKind(mediaId: string): Promise<MediaKind | null> {
  if (kindCache.has(mediaId)) return Promise.resolve(kindCache.get(mediaId) ?? null);
  const pending = kindInflight.get(mediaId);
  if (pending) return pending;
  const run = fetch(`/api/v1/media/${encodeURIComponent(mediaId)}`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { mime?: string | null } };
      return kindFromMime(body?.data?.mime);
    })
    .catch(() => null)
    .then((kind) => {
      kindCache.set(mediaId, kind);
      kindInflight.delete(mediaId);
      return kind;
    });
  kindInflight.set(mediaId, run);
  return run;
}

/** Test/helper hook: prime the cache when a list already returned asset MIME types. */
export function rememberMediaKind(src: string, mime?: string | null) {
  const id = mediaIdFromUrl(src);
  const kind = kindFromMime(mime);
  if (id && kind) kindCache.set(id, kind);
}

function initialKind(src: string, mime?: string | null): MediaKind | null {
  const known = kindFromMime(mime) ?? kindFromUrl(src);
  if (known) return known;
  const id = mediaIdFromUrl(src);
  return id ? (kindCache.get(id) ?? null) : null;
}

export function MediaSurface({
  src,
  mime,
  contentType,
  alt = '',
  className,
  autoPlay = false,
  loop = false,
  controls = false,
  preload,
  poster,
}: MediaSurfaceProps) {
  const [kind, setKind] = useState<MediaKind | null>(() => initialKind(src, mime));
  const [resolving, setResolving] = useState(() => kind === null && !!mediaIdFromUrl(src));
  // Each kind is tried at most once; after both fail we show the neutral fallback.
  const [failed, setFailed] = useState<Record<MediaKind, boolean>>({ image: false, video: false });

  useEffect(() => {
    const known = initialKind(src, mime);
    setFailed({ image: false, video: false });
    if (known) {
      setKind(known);
      setResolving(false);
      return;
    }
    const id = mediaIdFromUrl(src);
    if (!id) {
      // Opaque external URL: start with the hint, the other kind is tried on error.
      setKind(contentType === 'REEL' ? 'video' : 'image');
      setResolving(false);
      return;
    }
    let cancelled = false;
    setKind(null);
    setResolving(true);
    void resolveMediaKind(id).then((resolved) => {
      if (cancelled) return;
      setKind(resolved ?? (contentType === 'REEL' || contentType === 'STORY' ? 'video' : 'image'));
      setResolving(false);
    });
    return () => {
      cancelled = true;
    };
  }, [src, mime, contentType]);

  const classes = ['oma-media-surface', className].filter(Boolean).join(' ');

  const fail = (which: MediaKind) => {
    const next = { ...failed, [which]: true };
    const other: MediaKind = which === 'image' ? 'video' : 'image';
    setFailed(next);
    if (!next[other]) setKind(other);
  };

  if (resolving || kind === null) {
    return (
      <span
        className={`${classes} oma-media-surface__loading oma-skeleton`}
        role="img"
        aria-busy="true"
        aria-label={alt || undefined}
        data-media-kind="pending"
      />
    );
  }

  if (kind === 'video' && !failed.video) {
    return (
      <MediaVideo
        className={classes}
        src={videoUrlFor(src)}
        poster={poster}
        alt={alt}
        autoPlay={autoPlay}
        loop={loop || autoPlay}
        controls={controls}
        preload={preload}
        onError={() => fail('video')}
      />
    );
  }

  if (kind === 'image' && !failed.image) {
    return (
      <img
        className={classes}
        src={imageUrlFor(src)}
        alt={alt}
        loading={preload === 'auto' ? 'eager' : 'lazy'}
        decoding="async"
        data-media-kind="image"
        onError={() => fail('image')}
      />
    );
  }

  return (
    <span
      className={`${classes} oma-media-surface__fallback`}
      aria-hidden="true"
      data-media-kind="missing"
    />
  );
}

function MediaVideo({
  className,
  src,
  poster,
  alt,
  autoPlay,
  loop,
  controls,
  preload,
  onError,
}: {
  className: string;
  src: string;
  poster?: string;
  alt: string;
  autoPlay: boolean;
  loop: boolean;
  controls: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  onError: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  // Thumbnails without a poster need a decoded frame, so never use preload="none" for them.
  const effectivePreload =
    preload === 'auto' ? 'auto' : !poster || controls || autoPlay ? 'metadata' : (preload ?? 'metadata');
  // `#t=0.1` makes browsers (Safari included) paint the first frame instead of a black box.
  const frameSrc = !autoPlay && !poster && !src.includes('#') ? `${src}#t=0.1` : src;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // React does not reliably reflect `muted`; autoplay policies require the DOM property.
    if (!controls || autoPlay) el.muted = true;
    if (!autoPlay) return;
    const play = () => {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    };
    if (typeof IntersectionObserver === 'undefined') {
      play();
      return;
    }
    // Only play cards that are on screen; dozens of looping feed tiles stay cheap.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) play();
          else el.pause();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoPlay, controls, src]);

  return (
    <video
      ref={ref}
      className={className}
      src={frameSrc}
      poster={poster}
      muted={!controls || autoPlay}
      loop={loop}
      playsInline
      controls={controls}
      preload={effectivePreload}
      aria-label={alt || undefined}
      data-media-kind="video"
      onError={onError}
    />
  );
}
