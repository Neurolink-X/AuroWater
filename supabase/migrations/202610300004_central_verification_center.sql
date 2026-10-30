-- Extend private document slots for optional supplier business certificates.
-- No supplier is required to upload this document; absence never blocks approval.
alter table public.user_files
  drop constraint if exists user_files_document_slot_check;

alter table public.user_files
  add constraint user_files_document_slot_check
  check (
    document_slot is null or document_slot in (
      'aadhaar_front', 'aadhaar_back', 'profile_photo',
      'skill_certificate', 'business_certificate'
    )
  );

create index if not exists user_files_role_review_idx
  on public.user_files (document_slot, review_status, created_at desc)
  where document_slot is not null;
