-- KG-core (raw SQL, tracks KG_Schema_v2.json). Managed by hand, not Drizzle.
-- Apply AFTER `drizzle-kit push` (app tables must exist for FK targets in rls.sql).
-- Run: psql "$DATABASE_URL" -f packages/db/kg-core.sql

create extension if not exists vector;   -- pgvector for RAG (M2)
create extension if not exists pg_trgm;  -- hybrid/full-text helpers

-- Embedding dim 384 = Supabase in-edge `gte-small` (free, no external API).

-- ── KG versions (KG is versioned; student data pins to a version, Q27) ──────────
create table if not exists kg_versions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  subject     text not null,
  label       text not null,
  status      text not null default 'draft',  -- draft | published | archived
  created_at  timestamptz not null default now()
);

-- ── Nodes ──────────────────────────────────────────────────────────────────────
create table if not exists kg_nodes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  node_key     text not null,                 -- KG id, e.g. 'T_HSB2'
  subject      text not null,
  grade        text,
  chapter      text,
  cluster      text,
  label        text not null,
  type         text,                          -- KN | QT | KY | VD
  bloom_cu_tru text,
  mo_ta        text,
  tieu_chi_dung_grain text,
  est_minutes  int,
  status       text not null default 'review',-- review | active | retired
  approved_by  uuid references profiles(id),
  created_at   timestamptz not null default now(),
  unique (kg_version_id, node_key)
);
create index if not exists kg_nodes_version_idx on kg_nodes (kg_version_id);
create index if not exists kg_nodes_subject_idx on kg_nodes (subject, grade);

-- ── Edges (weighted multi-relation) ─────────────────────────────────────────────
create table if not exists kg_edges (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  from_key     text not null,
  to_key       text not null,
  relation     text not null,  -- prerequisite_hard | related_soft | misconception | cross_subject | part_of
  weight       real not null default 1.0,
  ghi_chu      text
);
create index if not exists kg_edges_to_idx   on kg_edges (kg_version_id, to_key, relation);
create index if not exists kg_edges_from_idx on kg_edges (kg_version_id, from_key, relation);

-- ── Tiers (3 mastery tiers per node) ────────────────────────────────────────────
create table if not exists kg_tiers (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  node_key     text not null,
  tier         int  not null check (tier between 1 and 3),
  ten          text,
  bloom        text,
  dok          int check (dok between 1 and 4),
  muc_tieu     text,
  unique (kg_version_id, node_key, tier)
);

-- ── Resources (chosen by knowledge nature, not "learning styles") ────────────────
create table if not exists resources (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  node_key     text not null,
  tier         int,
  format       text,           -- text | infographic | video | animation | worked_example | ...
  ly_do_chon_format text,
  dual_coding  boolean default false,
  accessibility text,
  uri          text,
  lang         text default 'vi',
  embedding    vector(384),
  status       text not null default 'review',
  created_at   timestamptz not null default now()
);
create index if not exists resources_node_idx on resources (kg_version_id, node_key);

-- ── Questions (two independent labels dok + do_kho; objective | rubric) ──────────
create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  question_key  text not null,
  node_key      text not null,
  tier          int,
  loai_danh_gia text not null,            -- objective | rubric
  dok           int  not null check (dok between 1 and 4),
  do_kho        text not null,            -- de | TB | kho   (INDEPENDENT of dok)
  noi_dung      text not null,
  -- objective
  dap_an        text,
  loi_giai      text,
  distractors   jsonb,                    -- [{phuong_an, quan_niem_sai}]
  tham_so_hoa   boolean default false,
  -- rubric (formative only; summative belongs to the teacher)
  rubric        jsonb,                    -- [{tieu_chi, thang_muc[]}]
  bai_mau       jsonb,                    -- exemplars (prefer boundary cases)
  loi_thuong_gap jsonb,
  -- post-deployment stats
  p_value        real,
  discrimination real,
  trang_thai     text not null default 'review',  -- active | review | retired
  embedding      vector(384),
  created_at     timestamptz not null default now(),
  unique (kg_version_id, question_key),
  constraint questions_kind_chk check (loai_danh_gia in ('objective','rubric')),
  -- objective must have an answer; rubric must have criteria
  constraint questions_objective_chk check (
    loai_danh_gia <> 'objective' or dap_an is not null
  ),
  constraint questions_rubric_chk check (
    loai_danh_gia <> 'rubric' or rubric is not null
  )
);
create index if not exists questions_node_idx on questions (kg_version_id, node_key, trang_thai);

-- ── Socratic ladders (one per misconception) ────────────────────────────────────
create table if not exists socratic_ladders (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  ladder_key   text not null,
  node_key     text not null,
  misconception text not null,
  rungs        jsonb not null,   -- [{bac, loai, cau_hoi}]
  bottom_out   jsonb not null,   -- {dieu_kien_mo, noi_dung}
  cong_no_luc  jsonb not null,   -- {so_lan_thu_toi_thieu, yeu_cau, contingent, cam}
  status       text not null default 'review',
  unique (kg_version_id, ladder_key)
);
create index if not exists ladders_node_idx on socratic_ladders (kg_version_id, node_key);
