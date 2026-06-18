export * from "./kg/types.js";

/** Roles for RBAC (app layer mirrors DB RLS groups). */
export type Role = "student" | "teacher" | "parent" | "admin" | "leadership";

/** The 4 RLS groups from the PRD. */
export type RlsGroup = "student" | "teacher" | "parent" | "admin";
