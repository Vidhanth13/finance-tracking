// finance_tracking — Postgres connection pool.
// Password has spaces, so pass discrete fields (never a DSN string).
import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.FINANCE_PGHOST || "localhost",
  port: Number(process.env.FINANCE_PGPORT || 5432),
  database: process.env.FINANCE_PGDATABASE || "finance_tracking",
  user: process.env.FINANCE_PGUSER || "finance_app",
  password: process.env.FINANCE_PGPASSWORD,   // from .env (git-ignored)
  max: 5,
});

export const q = (text, params) => pool.query(text, params);
