-- ─────────────────────────────────────────────────────────────────────────────
-- 0014 — kc_registry: bảng đối chiếu ID bất biến KC- ↔ mã vị trí cũ (đệm-0) +
-- nhãn. `learning-path` đọc cột vi_tri_trong_ct để TIEBREAK thứ tự bài khi tô-pô
-- không quyết định được (node_key là KC- ngẫu nhiên, không mang thứ tự).
--
-- Ở DB CŨ bảng này được tạo ad-hoc NGOÀI migration (nên nhà mới thiếu → 0013
-- vấp). Đưa vào migration cho tử tế. Do `content-sync` nạp từ Studio.atoms
-- (id = KC-, code = mã vị trí = vi_tri_trong_ct). Chỉ service_role (edge) đọc.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.kc_registry (
  node_key        text primary key,
  vi_tri_trong_ct text,
  label           text,
  subject         text,
  grade           text,
  chapter         text,
  ngay_cap        date not null default current_date,
  constraint kc_registry_node_key_check check (node_key ~ '^KC-[0-9]{7}$')
);
create index if not exists kc_registry_vitri_idx on public.kc_registry (vi_tri_trong_ct);

alter table public.kc_registry enable row level security;
-- KHÔNG policy → chỉ service_role (edge functions, bypass RLS) đọc/ghi; client
-- không thấy. Đây là bảng đối chiếu nội bộ, không phục vụ trực tiếp giao diện.
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='kc_registry') then
    execute 'alter table public.kc_registry force row level security;';
  end if;
end $$;
