import {
  FacebookGlyph,
  InstagramGlyph,
  LinkedInGlyph,
  TikTokGlyph,
} from '../../../../components/landing/platform-icons';
import { platformAccent, platformShort } from './inbox-utils';

const GLYPHS: Record<string, typeof FacebookGlyph> = {
  META_FB: FacebookGlyph,
  META_IG: InstagramGlyph,
  TIKTOK: TikTokGlyph,
  LINKEDIN: LinkedInGlyph,
};

export function InboxPlatformIcon({
  platform,
  size = 14,
  className,
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  const G = GLYPHS[platform];
  if (!G) {
    return (
      <span className={['oma-plx-inbox-plat-fallback', className].filter(Boolean).join(' ')}>
        {platformShort(platform)}
      </span>
    );
  }
  return (
    <span
      className={['oma-plx-inbox-plat-icon', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, color: platformAccent(platform) }}
    >
      <G />
    </span>
  );
}

export function InboxPlatformBadge({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  return (
    <span
      className={['oma-plx-inbox-plat-badge', `oma-plx-inbox-plat-badge--${platform}`, className]
        .filter(Boolean)
        .join(' ')}
      style={{ background: platformAccent(platform), color: '#fff' }}
      title={platformShort(platform)}
    >
      <InboxPlatformIcon platform={platform} size={10} className="oma-plx-inbox-plat-badge__glyph" />
    </span>
  );
}
