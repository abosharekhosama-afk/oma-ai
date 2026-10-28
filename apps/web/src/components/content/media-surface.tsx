'use client';

import { useMemo, useState } from 'react';

type MediaSurfaceProps = {
  src: string;
  contentType?: string;
  alt?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  poster?: string;
};

function mediaIdFromViewUrl(src: string) {
  return /^\/api\/v1\/media\/([^/]+)\/view(?:[?#].*)?$/.exec(src)?.[1] ?? null;
}

function looksLikeVideo(src: string, contentType?: string) {
  return (
    contentType === 'REEL' ||
    contentType === 'STORY' ||
    /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/i.test(src) ||
    /\/stream(?:[?#]|$)/i.test(src)
  );
}

/** Shared media renderer for feed, tasks, deliverables and review surfaces. */
export function MediaSurface({
  src,
  contentType,
  alt = '',
  className,
  autoPlay = false,
  loop = false,
  controls = false,
  preload = 'none',
  poster,
}: MediaSurfaceProps) {
  const [failed, setFailed] = useState(false);
  const isVideo = useMemo(() => looksLikeVideo(src, contentType), [src, contentType]);
  const mediaId = mediaIdFromViewUrl(src);
  // WorkDrive preview URLs are redirects intended for images. Video needs the stable OMA
  // stream route so the browser can request byte ranges instead of downloading the full file.
  const videoSrc = mediaId ? `/api/v1/media/${mediaId}/stream` : src;
  const classes = ['oma-media-surface', className].filter(Boolean).join(' ');

  if (isVideo && !failed) {
    return (
      <video
        className={classes}
        src={videoSrc}
        poster={poster}
        muted={autoPlay}
        autoPlay={autoPlay}
        loop={loop}
        playsInline
        controls={controls}
        preload={controls ? 'metadata' : preload}
        aria-label={alt || undefined}
        onError={() => setFailed(true)}
      />
    );
  }

  if (!failed) {
    return (
      <img
        className={classes}
        src={src}
        alt={alt}
        loading={preload === 'auto' ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className={`${classes} oma-media-surface__fallback`} aria-hidden="true" />;
}
