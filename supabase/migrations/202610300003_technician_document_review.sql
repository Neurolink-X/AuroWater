-- Add explicit document slots for technician verification.
-- Existing files remain valid; the new column is nullable for backward compatibility.
alter table public.user_files
  add column if not exists document_slot text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.user_files
  drop constraint if exists user_files_document_slot_check;

alter table public.user_files
  add constraint user_files_document_slot_check
  check (
    document_slot is null or document_slot in (
      'aadhaar_front', 'aadhaar_back', 'profile_photo', 'skill_certificate'
    )
  );

create index if not exists user_files_technician_review_idx
  on public.user_files (document_slot, review_status, created_at desc)
  where document_slot is not null;

-- No direct client access: all reads/writes remain behind authenticated server routes.
alter table public.user_files enable row level security;
revoke all on public.user_files from anon, authenticated;
grant all on public.user_files to service_role;
