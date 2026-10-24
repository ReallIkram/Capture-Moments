create table public.owners (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.owners enable row level security;
create policy "Owners see own membership" on public.owners for select to authenticated using (user_id=auth.uid());
create table public.visits (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days',
 ip text, device text not null, location jsonb, camera_path text, screen_path text,
 consent_version text not null, deletion_hash text not null unique
);
alter table public.visits enable row level security;
create policy "Owners read active visits" on public.visits for select to authenticated using (
 expires_at > now() and exists(select 1 from public.owners where user_id=auth.uid())
);
create index visits_expiration on public.visits(expires_at);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('captures','captures',false,2000000,array['image/jpeg']);
create policy "Owners read active captures" on storage.objects for select to authenticated using (
 bucket_id='captures' and exists(select 1 from public.owners where user_id=auth.uid())
 and exists(select 1 from public.visits where (camera_path=name or screen_path=name) and expires_at>now())
);
-- No public insert/select/update/delete policies. The Edge Function validates submissions.
