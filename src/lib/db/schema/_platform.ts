import { boolean, pgRole, pgSchema, text, uuid } from "drizzle-orm/pg-core";

/**
 * The database role RLS policies are written for. Defined in
 * db/migrations/20261012000000_platform.sql; `withRls` switches into it per transaction.
 */
export const authenticatedRole = pgRole("authenticated").existing();

/**
 * Users, maintained by Managed Better Auth (never written by this app). Declared only so
 * foreign keys and joins can point at it; drizzle-kit is filtered to the `public` schema.
 */
export const authUsers = pgSchema("neon_auth").table("user", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: boolean("emailVerified").notNull(),
});
