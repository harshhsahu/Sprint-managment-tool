<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database migrations

The database layer uses Mongoose (MongoDB) — models live in `src/models/`.

Whenever a change touches the DB level — a new model, a new/renamed/removed field, a changed type, a new index, or a required backfill of existing documents — you MUST create a corresponding `migration.js` at the **root level** of the repo alongside the code change.

Rules:
- Name it `migration.js` (or, if one already exists, add a new timestamped file `migration.<YYYYMMDDHHMM>.js` so existing migrations are not overwritten).
- Make it runnable standalone with `node migration.js`; connect using the same connection string / env var the app uses (e.g. `MONGODB_URI`).
- Each migration must be **idempotent** — safe to re-run without duplicating or corrupting data.
- Include both the forward change and, where feasible, a documented rollback (an `down`/revert path or clear inline notes).
- Log a clear summary of what was changed and how many documents were affected.
- Schema-only edits in `src/models/` with no impact on existing stored documents do not need a migration; anything that alters the shape or integrity of data already in the database does.
