-- ============================================
-- PET.RA CLAIMS AI — DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ---------- EXTENSIONS ----------
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLE: companies (insurance companies)
-- ============================================
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business_email text unique not null,
  logo_url text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid, -- super admin user id
  created_at timestamptz not null default now()
);

-- ============================================
-- TABLE: profiles (extends Supabase auth.users)
-- role: 'customer' | 'company_admin' | 'super_admin'
-- ============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('customer', 'company_admin', 'super_admin')),
  full_name text,
  phone text,
  company_id uuid references companies(id) on delete cascade, -- only set for company_admin
  created_at timestamptz not null default now()
);

-- ============================================
-- TABLE: policies (customer <-> insurer connection)
-- ============================================
create table policies (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  policy_number text not null,
  membership_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (customer_id, company_id, policy_number)
);

-- ============================================
-- TABLE: claims
-- ============================================
create table claims (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,
  incident_type text not null check (incident_type in ('collision', 'theft', 'fire', 'flood', 'other')),
  incident_description text,
  incident_gps_lat double precision,
  incident_gps_lng double precision,
  incident_timestamp timestamptz,
  device_info text,
  status text not null default 'submitted' check (
    status in ('submitted', 'under_review', 'approved', 'rejected', 'closed')
  ),
  adjuster_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- TABLE: claim_media (photo evidence)
-- ============================================
create table claim_media (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  storage_path text not null, -- path within Supabase Storage bucket
  media_type text not null default 'photo' check (media_type in ('photo')), -- video added in v2
  angle_label text, -- e.g. 'front', 'rear', 'left', 'right', 'damage_closeup'
  created_at timestamptz not null default now()
);

-- ============================================
-- TABLE: ai_results (one row per claim, AI analysis output)
-- ============================================
create table ai_results (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null unique references claims(id) on delete cascade,
  risk_score integer check (risk_score between 0 and 100),
  damage_severity text check (damage_severity in ('minor', 'moderate', 'severe', 'unclear')),
  confidence_score integer check (confidence_score between 0 and 100),
  missing_evidence jsonb default '[]'::jsonb,
  fraud_indicators jsonb default '[]'::jsonb,
  fraud_flag boolean not null default false,
  summary text,
  raw_response text, -- full model output, for debugging
  manual_review_required boolean not null default false,
  analyzed_at timestamptz not null default now()
);

-- ============================================
-- TABLE: notifications
-- ============================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  claim_id uuid references claims(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_policies_customer on policies(customer_id);
create index idx_policies_company on policies(company_id);
create index idx_claims_company on claims(company_id);
create index idx_claims_customer on claims(customer_id);
create index idx_claims_status on claims(status);
create index idx_claim_media_claim on claim_media(claim_id);
create index idx_notifications_recipient on notifications(recipient_id, is_read);

-- ============================================
-- updated_at trigger for claims
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_claims_updated_at
before update on claims
for each row execute function set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table companies enable row level security;
alter table profiles enable row level security;
alter table policies enable row level security;
alter table claims enable row level security;
alter table claim_media enable row level security;
alter table ai_results enable row level security;
alter table notifications enable row level security;

-- ---------- companies ----------
-- Anyone authenticated can read verified companies (for "connect insurer" search)
create policy "verified companies are readable by all authenticated users"
on companies for select
to authenticated
using (is_verified = true);

-- company_admin can read their own company even if unverified
create policy "company admin can read own company"
on companies for select
to authenticated
using (
  id in (select company_id from profiles where id = auth.uid())
);

-- super_admin can do everything
create policy "super admin full access to companies"
on companies for all
to authenticated
using (
  exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
);

-- company_admin can update their own company (e.g. logo)
create policy "company admin can update own company"
on companies for update
to authenticated
using (id in (select company_id from profiles where id = auth.uid() and role = 'company_admin'));

-- any authenticated user can create a company (registration flow), starts unverified
create policy "authenticated users can register a company"
on companies for insert
to authenticated
with check (true);

-- ---------- profiles ----------
create policy "users can read own profile"
on profiles for select
to authenticated
using (id = auth.uid());

create policy "company admin can read profiles of their customers"
on profiles for select
to authenticated
using (
  role = 'customer' and id in (
    select customer_id from policies where company_id in (
      select company_id from profiles where id = auth.uid() and role = 'company_admin'
    )
  )
);

create policy "super admin can read all profiles"
on profiles for select
to authenticated
using (exists (select 1 from profiles where id = auth.uid() and role = 'super_admin'));

create policy "users can insert own profile"
on profiles for insert
to authenticated
with check (id = auth.uid());

create policy "users can update own profile"
on profiles for update
to authenticated
using (id = auth.uid());

-- ---------- policies ----------
create policy "customer can manage own policies"
on policies for all
to authenticated
using (customer_id = auth.uid());

create policy "company admin can read policies linked to their company"
on policies for select
to authenticated
using (
  company_id in (select company_id from profiles where id = auth.uid() and role = 'company_admin')
);

-- ---------- claims ----------
create policy "customer can manage own claims"
on claims for all
to authenticated
using (customer_id = auth.uid());

create policy "company admin can read claims for their company"
on claims for select
to authenticated
using (
  company_id in (select company_id from profiles where id = auth.uid() and role = 'company_admin')
);

create policy "company admin can update claims for their company"
on claims for update
to authenticated
using (
  company_id in (select company_id from profiles where id = auth.uid() and role = 'company_admin')
);

create policy "super admin can read all claims"
on claims for select
to authenticated
using (exists (select 1 from profiles where id = auth.uid() and role = 'super_admin'));

-- ---------- claim_media ----------
create policy "customer can manage media for own claims"
on claim_media for all
to authenticated
using (
  claim_id in (select id from claims where customer_id = auth.uid())
);

create policy "company admin can read media for their company's claims"
on claim_media for select
to authenticated
using (
  claim_id in (
    select id from claims where company_id in (
      select company_id from profiles where id = auth.uid() and role = 'company_admin'
    )
  )
);

-- ---------- ai_results ----------
create policy "customer can read ai results for own claims"
on ai_results for select
to authenticated
using (
  claim_id in (select id from claims where customer_id = auth.uid())
);

create policy "company admin can read ai results for their company's claims"
on ai_results for select
to authenticated
using (
  claim_id in (
    select id from claims where company_id in (
      select company_id from profiles where id = auth.uid() and role = 'company_admin'
    )
  )
);

-- only service role (backend function) writes ai_results — no insert/update policy for regular users

-- ---------- notifications ----------
create policy "users can read own notifications"
on notifications for select
to authenticated
using (recipient_id = auth.uid());

create policy "users can update own notifications (mark read)"
on notifications for update
to authenticated
using (recipient_id = auth.uid());

-- ============================================
-- STORAGE BUCKET (configure separately)
-- ============================================
-- Create a bucket named 'claim-evidence' in Supabase Storage dashboard, set to PRIVATE.
-- Storage policies are configured separately on storage.objects — ask for that SQL
-- once the bucket is created, since the path convention depends on how the upload
-- function names files.
