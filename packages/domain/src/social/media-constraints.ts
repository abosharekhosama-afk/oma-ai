/**
 * Per-network media constraints for publish validation (compose UI + worker).
 * Sources: TikTok Content Posting API; Meta Graph API (IG/FB) common limits.
 */

export type SocialNetworkKey = 'tiktok' | 'instagram' | 'facebook' | 'linkedin' | 'x';

export type MediaConstraint = {
  network: SocialNetworkKey;
  photoMimes: string[];
  videoMimes: string[];
  maxPhotoBytes: number;
  maxVideoBytes: number;
  /** Longest edge in pixels for photos (null = no resize requirement). */
  maxPhotoEdgePx: number | null;
  maxPhotosPerPost: number;
  maxVideosPerPost: number;
  allowMixPhotoVideo: boolean;
  notes: { en: string; ar: string };
};

export const NETWORK_MEDIA_CONSTRAINTS: Record<SocialNetworkKey, MediaConstraint> = {
  tiktok: {
    network: 'tiktok',
    photoMimes: ['image/jpeg', 'image/webp'],
    videoMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxPhotoBytes: 20 * 1024 * 1024,
    maxVideoBytes: 500 * 1024 * 1024,
    maxPhotoEdgePx: 1080,
    maxPhotosPerPost: 35,
    maxVideosPerPost: 1,
    allowMixPhotoVideo: false,
    notes: {
      en: 'TikTok photos must be JPEG/WebP, ≤20 MB, and at most 1080p. Videos: MP4/WebM/MOV.',
      ar: 'صور تيك توك يجب أن تكون JPEG/WebP وبحد أقصى 20 ميغابايت وبدقة 1080p. الفيديو: MP4/WebM/MOV.',
    },
  },
  instagram: {
    network: 'instagram',
    photoMimes: ['image/jpeg', 'image/png'],
    videoMimes: ['video/mp4', 'video/quicktime'],
    maxPhotoBytes: 8 * 1024 * 1024,
    maxVideoBytes: 100 * 1024 * 1024,
    maxPhotoEdgePx: 1440,
    maxPhotosPerPost: 10,
    maxVideosPerPost: 1,
    allowMixPhotoVideo: false,
    notes: {
      en: 'Instagram prefers JPEG; carousel up to 10. Keep the longest edge ≤1440px when possible.',
      ar: 'إنستغرام يفضّل JPEG؛ حتى 10 صور في المنشور. يُفضّل ألا يتجاوز أطول ضلع 1440 بكسل.',
    },
  },
  facebook: {
    network: 'facebook',
    photoMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    videoMimes: ['video/mp4', 'video/quicktime'],
    maxPhotoBytes: 10 * 1024 * 1024,
    maxVideoBytes: 1024 * 1024 * 1024,
    maxPhotoEdgePx: null,
    maxPhotosPerPost: 10,
    maxVideosPerPost: 1,
    allowMixPhotoVideo: false,
    notes: {
      en: 'Facebook accepts common image formats; large PNGs may be slow to upload.',
      ar: 'فيسبوك يقبل صيغ الصور الشائعة؛ ملفات PNG الكبيرة قد تبطئ الرفع.',
    },
  },
  linkedin: {
    network: 'linkedin',
    photoMimes: ['image/jpeg', 'image/png', 'image/gif'],
    videoMimes: ['video/mp4'],
    maxPhotoBytes: 10 * 1024 * 1024,
    maxVideoBytes: 200 * 1024 * 1024,
    maxPhotoEdgePx: null,
    maxPhotosPerPost: 9,
    maxVideosPerPost: 1,
    allowMixPhotoVideo: false,
    notes: {
      en: 'LinkedIn accepts JPEG/PNG/GIF photos and MP4 video.',
      ar: 'لينكدإن يقبل صور JPEG/PNG/GIF وفيديو MP4.',
    },
  },
  x: {
    network: 'x',
    photoMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    videoMimes: ['video/mp4'],
    maxPhotoBytes: 5 * 1024 * 1024,
    maxVideoBytes: 512 * 1024 * 1024,
    maxPhotoEdgePx: null,
    maxPhotosPerPost: 4,
    maxVideosPerPost: 1,
    allowMixPhotoVideo: false,
    notes: {
      en: 'X (Twitter) allows up to 4 images or one MP4 video.',
      ar: 'منصة X تسمح حتى 4 صور أو فيديو MP4 واحد.',
    },
  },
};

export type MediaAssetInfo = {
  mime: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
};

export type MediaValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: { en: string; ar: string };
};

function normMime(m: string) {
  return m.toLowerCase().split(';')[0]!.trim();
}

/** Validate assets against a network before publish. */
export function validateMediaForNetwork(
  network: string,
  assets: MediaAssetInfo[],
  opts?: { contentType?: string | null },
): MediaValidationIssue[] {
  const key = network.toLowerCase() as SocialNetworkKey;
  const c = NETWORK_MEDIA_CONSTRAINTS[key];
  if (!c) return [];
  const issues: MediaValidationIssue[] = [];
  if (!assets.length) {
    issues.push({
      code: 'media_missing',
      severity: 'error',
      message: {
        en: 'Attach at least one photo or video before publishing.',
        ar: 'أرفق صورة أو فيديو واحداً على الأقل قبل النشر.',
      },
    });
    return issues;
  }
  const photos = assets.filter((a) => normMime(a.mime).startsWith('image/'));
  const videos = assets.filter((a) => normMime(a.mime).startsWith('video/'));
  const contentType = String(opts?.contentType || '').toUpperCase();
  if (
    key === 'tiktok' &&
    (contentType === 'REEL' || contentType === 'VIDEO') &&
    videos.length === 0
  ) {
    issues.push({
      code: 'reel_requires_video',
      severity: 'error',
      message: {
        en: 'TikTok Reels require a video file. Images cannot be published as a Reel.',
        ar: 'ريلز TikTok يتطلب ملف فيديو. لا يمكن نشر صورة كريلز.',
      },
    });
  }
  if (!c.allowMixPhotoVideo && photos.length && videos.length) {
    issues.push({
      code: 'mixed_media',
      severity: 'error',
      message: {
        en: 'This network does not allow mixing photos and videos in one post.',
        ar: 'هذه الشبكة لا تسمح بخلط الصور والفيديو في منشور واحد.',
      },
    });
  }
  if (photos.length > c.maxPhotosPerPost) {
    issues.push({
      code: 'photo_count',
      severity: 'error',
      message: {
        en: `At most ${c.maxPhotosPerPost} photos are allowed.`,
        ar: `يُسمح بحد أقصى ${c.maxPhotosPerPost} صور.`,
      },
    });
  }
  if (videos.length > c.maxVideosPerPost) {
    issues.push({
      code: 'video_count',
      severity: 'error',
      message: {
        en: `At most ${c.maxVideosPerPost} video(s) are allowed.`,
        ar: `يُسمح بحد أقصى ${c.maxVideosPerPost} فيديو.`,
      },
    });
  }
  for (const a of photos) {
    const mime = normMime(a.mime);
    if (!c.photoMimes.includes(mime)) {
      issues.push({
        code: 'photo_mime',
        severity: 'warning',
        message: {
          en: `Photo type ${mime} will be converted for ${c.network} (needs ${c.photoMimes.join('/')}).`,
          ar: `نوع الصورة ${mime} سيُحوَّل تلقائياً لـ ${c.network}.`,
        },
      });
    }
    if (a.sizeBytes != null && a.sizeBytes > c.maxPhotoBytes) {
      issues.push({
        code: 'photo_bytes',
        severity: 'error',
        message: {
          en: `Photo exceeds ${Math.round(c.maxPhotoBytes / (1024 * 1024))} MB limit.`,
          ar: `حجم الصورة يتجاوز ${Math.round(c.maxPhotoBytes / (1024 * 1024))} ميغابايت.`,
        },
      });
    }
    if (c.maxPhotoEdgePx && a.width && a.height) {
      const edge = Math.max(a.width, a.height);
      if (edge > c.maxPhotoEdgePx) {
        issues.push({
          code: 'photo_dimensions',
          severity: 'warning',
          message: {
            en: `Photo ${a.width}×${a.height} exceeds ${c.maxPhotoEdgePx}p and will be resized.`,
            ar: `أبعاد الصورة ${a.width}×${a.height} تتجاوز ${c.maxPhotoEdgePx}p وسيتم تصغيرها.`,
          },
        });
      }
    }
  }
  for (const a of videos) {
    const mime = normMime(a.mime);
    if (!c.videoMimes.includes(mime)) {
      issues.push({
        code: 'video_mime',
        severity: 'error',
        message: {
          en: `Video type ${mime} is not supported on ${c.network}. Use ${c.videoMimes.join(', ')}.`,
          ar: `نوع الفيديو ${mime} غير مدعوم على ${c.network}.`,
        },
      });
    }
    if (a.sizeBytes != null && a.sizeBytes > c.maxVideoBytes) {
      issues.push({
        code: 'video_bytes',
        severity: 'error',
        message: {
          en: `Video exceeds size limit for ${c.network}.`,
          ar: `حجم الفيديو يتجاوز الحد المسموح لـ ${c.network}.`,
        },
      });
    }
  }
  return issues;
}

/** Whether worker should transcode an image for this network. */
export function imageNeedsTranscode(
  network: string,
  mime: string,
  width?: number | null,
  height?: number | null,
): boolean {
  const key = network.toLowerCase() as SocialNetworkKey;
  const c = NETWORK_MEDIA_CONSTRAINTS[key];
  if (!c) return false;
  const m = normMime(mime);
  if (!m.startsWith('image/')) return false;
  if (!c.photoMimes.includes(m)) return true;
  if (c.maxPhotoEdgePx && width && height && Math.max(width, height) > c.maxPhotoEdgePx) return true;
  return false;
}
