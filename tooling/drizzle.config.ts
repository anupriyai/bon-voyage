import { defineConfig } from "drizzle-kit";

process.loadEnvFile?.(".env.local");

// Migrations run as the owner role (on Neon: the direct, non-pooled host). The app connects as bv_app.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./domains/account/db.ts", "./domains/case/db.ts"],
  out: "./shared/lib/db/migrations",
  dbCredentials: { url: process.env.DATABASE_OWNER_URL! },
});
