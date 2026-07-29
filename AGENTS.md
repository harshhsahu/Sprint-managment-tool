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

## Mongoose model caching — new schema fields "silently don't save"

Symptom (recurs on **every** new project/task/etc. field): a PATCH sends the correct payload, the API returns 200, but the new field never persists and the UI shows the old value after refetch.

Cause: Mongoose caches compiled models on its module-global `mongoose.models` registry. When a `src/models` schema gains a field while the dev server is already running, Next.js Fast Refresh reloads the module but does **not** recompile the Mongoose model — the stale model keeps its old paths, and **strict mode silently strips the unknown field** from `findByIdAndUpdate`/`$set` writes. So the write "succeeds" while dropping the new field.

Rules when adding/renaming a field on any schema in `src/models/`:
- `src/models/index.ts` uses a `defineModel()` helper that recompiles models in development (drops the cached model via `mongoose.deleteModel` so Fast Refresh picks up schema edits). Register every model through it — never reintroduce the raw `models.X || model("X", schema)` pattern, or the field-stripping bug comes back.
- If writes to a newly added field still don't persist, **fully restart the dev server** (not just save-to-reload) so the model recompiles, then retry.
- When you add a field, verify it round-trips end-to-end (save → refetch shows the new value) before considering the feature done — don't trust a 200 alone.
- Also make sure the field is in the route's Zod/validation schema (an unlisted field is stripped at the API layer too) **and** returned by the GET route (no `.select()` that omits it).
