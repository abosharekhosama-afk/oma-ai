'use client';

import { useState } from 'react';

type MediaSurfaceProps = {
  src: string;
  contentType?: string;
  alt?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
};

/**
 * Inline content media used by feed, stories and list previews.
 * Reels and Stories are treated as videos, with an image fallback for older content.
 */
export function MediaSurface({
  src,
  contentType,
  alt = '',
  className,
  autoPlay = true,
  loop = true,
}: MediaSurfaceProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const isVideo = contentType === 'REEL' || contentType === 'STORY';
  const classes = ['oma-media-surface', className].filter(Boolean).join(' ');

  if (isVideo && !videoFailed) {
    return (
      <video
        className={classes}
        src={src}
        muted
        autoPlay={autoPlay}
        loop={loop}
        playsInline
        preload="metadata"
        aria-hidden="true"
        onError={() => setVideoFailed(true)}
      />
    );
  }

  if (imageFailed) {
    return <span className={`${classes} oma-media-surface__fallback`} aria-hidden="true" />;
  }

  return (
    <img
      className={classes}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}
