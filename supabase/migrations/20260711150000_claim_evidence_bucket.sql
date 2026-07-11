-- Private evidence bucket for claim journey proofs (service-role access only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-evidence',
  'claim-evidence',
  false,
  10485760,
  array['application/pdf', 'text/csv', 'application/octet-stream', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;
