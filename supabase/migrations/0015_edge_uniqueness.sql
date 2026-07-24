-- ─────────────────────────────────────────────────────────────────────────────
-- 0015 — kg_edges: thêm UNIQUE (kg_version_id, from_key, to_key, relation).
-- 0002 tạo kg_edges KHÔNG có ràng buộc tự nhiên → (a) cạnh trùng có thể lọt vào,
-- (b) upsert ... on conflict không chạy được (thiếu unique để khớp). content-sync
-- + import-kg cần ràng buộc này để idempotent. Gồm `relation` vì MỘT cặp node có
-- thể mang NHIỀU loại cạnh (prerequisite_hard + related_soft + misconception…).
-- Idempotent qua guard tên ràng buộc.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kg_edges_ver_from_to_rel_uq') then
    alter table public.kg_edges
      add constraint kg_edges_ver_from_to_rel_uq unique (kg_version_id, from_key, to_key, relation);
  end if;
end $$;
