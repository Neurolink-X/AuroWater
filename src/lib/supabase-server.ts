/**
 * Server-only Supabase helpers (service role + cookie SSR client).
 * Prefer importing from here in route handlers when documenting admin/service access.
 */
export { createClient, createServiceClient } from '@/utils/supabase/server';
