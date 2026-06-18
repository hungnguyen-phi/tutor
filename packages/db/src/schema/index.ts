/**
 * Drizzle schema barrel (app tables). KG-core tables (kg_versions, kg_nodes,
 * kg_edges, kg_tiers, resources, questions, socratic_ladders) are managed in
 * raw SQL — see kg-core.sql — and are not declared here.
 */
export * from "./tenancy";
export * from "./learning";
export * from "./governance";
export * from "./gateway";
