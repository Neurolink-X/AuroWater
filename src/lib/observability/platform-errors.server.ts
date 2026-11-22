import 'server-only';
import { createServiceClient } from '@/utils/supabase/server';
import { validatePlatformEvent } from './platform-errors';
/** Fail-open diagnostics: no user operation depends on a successful error write. */
export async function recordPlatformError(input: unknown): Promise<boolean> {
  const event = validatePlatformEvent(input);
  if (!event) return false;
  try {
    const { error } = await createServiceClient().rpc('record_platform_error', {
      p_code: event.code, p_group: event.group, p_path: event.path,
      p_status: event.status, p_source: event.source,
    }).abortSignal(AbortSignal.timeout(2500));
    if (error) { console.error('[platform-errors] persistence unavailable', { code: error.code }); return false; }
    return true;
  } catch { return false; }
}
