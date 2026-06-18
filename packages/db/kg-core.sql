-- KG-core (raw SQL, tracks KG_Schema_v2.json). Filled out in M1.
-- Drizzle owns app tables; these KG tables are managed here by hand.

create extension if not exists vector;      -- pgvector for RAG (M2)
create extension if not exists pg_trgm;     -- hybrid/full-text search helpers

-- M1 will add: kg_versions, kg_nodes, kg_edges, kg_tiers, resources,
-- questions (objective|rubric), socratic_ladders — all tenant_id + RLS.
