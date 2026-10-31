/**
 * Canonical footer social profiles.
 *
 * We deliberately do not link to the generic Instagram/Facebook homepages.
 * Those were used as placeholders in an older footer and could mislead
 * customers into thinking they were official AuroTap accounts.
 *
 * Configure actual verified public profile URLs in Vercel production:
 * NEXT_PUBLIC_AUROTAP_INSTAGRAM_URL
 * NEXT_PUBLIC_AUROTAP_FACEBOOK_URL
 * NEXT_PUBLIC_AUROTAP_LINKEDIN_URL
 * NEXT_PUBLIC_AUROTAP_YOUTUBE_URL
 *
 * These are public URLs, never access tokens. Leave unset until an official
 * account is ready. WhatsApp remains available from the existing footer CTA.
 */
export type FooterSocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'youtube';

export type FooterSocialProfile = {
  platform: FooterSocialPlatform;
  label: string;
  href: string;
};

const HOSTS: Record<FooterSocialPlatform, readonly string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  linkedin: ['linkedin.com', 'www.linkedin.com'],
  youtube: ['youtube.com', 'www.youtube.com'],
};

const NON_PROFILE_PATHS = new Set([
  '/', '/home', '/login', '/signup', '/explore', '/explore/', '/reels',
  '/reel', '/share', '/stories', '/feed', '/watch', '/shorts',
]);

/**
 * Accept only HTTPS links on the expected platform domains, with a profile
 * path. A generic platform homepage is NOT an AuroTap social media link.
 * Reject external redirect parameters, credentials and in-app fragments.
 */
export function normalizeFooterSocialUrl(
  platform: FooterSocialPlatform,
  candidate: string | undefined | null,
): string | null {
  if (!candidate || typeof candidate !== 'string') return null;
  const raw = candidate.trim();
  if (raw.length > 350) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !HOSTS[platform].includes(url.hostname.toLowerCase())) {
    return null;
  }
  if (url.username || url.password || url.port || url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (!path || NON_PROFILE_PATHS.has(path.toLowerCase())) return null;

  const segments = path.split('/').filter(Boolean);
  if (platform === 'linkedin') {
    if (!['company', 'showcase'].includes(segments[0] ?? '') || segments.length !== 2) return null;
  } else if (platform === 'youtube') {
    if (segments.length !== 1 || !segments[0]?.startsWith('@')) return null;
  } else if (platform === 'instagram') {
    if (segments.length !== 1 || !/^[a-z0-9._]{2,30}$/i.test(segments[0])) return null;
  } else if (platform === 'facebook') {
    if (segments.length < 1 || segments.length > 2) return null;
  }
  // Do not permit encoded separators, query redirects, or backslash tricks.
  if (/%2f|%5c|\\/i.test(url.pathname)) return null;
  return url.origin + path + '/';
}

type SocialConfig = {
  platform: FooterSocialPlatform;
  label: string;
  url: string | undefined;
};

export function getFooterSocialProfiles(): FooterSocialProfile[] {
  // Direct env reads are intentional so Next.js can safely inline them
  // into the client bundle at build time.
  const entries: SocialConfig[] = [
    { platform: 'instagram', label: 'Instagram', url: process.env.NEXT_PUBLIC_AUROTAP_INSTAGRAM_URL },
    { platform: 'facebook', label: 'Facebook', url: process.env.NEXT_PUBLIC_AUROTAP_FACEBOOK_URL },
    { platform: 'linkedin', label: 'LinkedIn', url: process.env.NEXT_PUBLIC_AUROTAP_LINKEDIN_URL },
    { platform: 'youtube', label: 'YouTube', url: process.env.NEXT_PUBLIC_AUROTAP_YOUTUBE_URL },
  ];
  return entries.flatMap(({ platform, label, url }) => {
    const href = normalizeFooterSocialUrl(platform, url);
    return href ? [{ platform, label, href }] : [];
  });
}
