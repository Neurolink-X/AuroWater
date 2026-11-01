// PATH: src/lib/contact-settings.ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CONTACT, SETTINGS_KEYS, parseContactSettings, type ContactSettings } from '@/lib/contact-shared';

type Row = { key: string; value: unknown };

/**
 * Cached server-side read of the admin-managed contact settings.
 * - Revalidated every 60 s, or instantly via revalidateTag('contact-settings') after an admin edit.
 * - The cached function THROWS on database errors, and Next never caches a throw,
 *   so an outage can never get "stuck" in the cache for a minute.
 * - Returns null when Supabase is not configured at all.
 */
const readRows = unstable_cache(
  async (): Promise<Row[] | null> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('settings').select('key,value').in('key', [...SETTINGS_KEYS]);
    if (error) throw error;
    return (data ?? []) as Row[];
  },
  ['contact-settings'],
  { revalidate: 60, tags: ['contact-settings'] },
);

export type ContactSettingsResult = { settings: ContactSettings; source: 'live' | 'fallback' };

/** Never throws. `source` tells callers (and monitoring) whether they are looking at live data or safe defaults. */
export async function getContactSettingsWithMeta(): Promise<ContactSettingsResult> {
  try {
    const rows = await readRows();
    if (rows === null) {
      console.error('[contact-settings] Supabase env missing, serving defaults');
      return { settings: DEFAULT_CONTACT, source: 'fallback' };
    }
    return { settings: parseContactSettings(rows), source: 'live' };
  } catch (error) {
    console.error('[contact-settings] database read failed, serving defaults', error);
    return { settings: DEFAULT_CONTACT, source: 'fallback' };
  }
}

export async function getContactSettings(): Promise<ContactSettings> {
  return (await getContactSettingsWithMeta()).settings;
}
