import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';
import { canIndexDeployment, createRobotsPolicy } from '@/lib/seo-policy';

const BASE_URL = getSiteUrl().replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  const canIndex = canIndexDeployment({
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    allowIndexing: process.env.ALLOW_INDEXING,
  });

  return createRobotsPolicy(canIndex, BASE_URL) as MetadataRoute.Robots;
}
