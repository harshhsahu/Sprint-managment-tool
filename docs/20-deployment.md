# 20 Deployment

## Environments
| Env | URL | Purpose |
|---|---|---|
| dev | http://localhost:3000 | local development |
| production | Cloud Run service URL | live app |

## Pipeline
- **Image:** multi-stage [`Dockerfile`](../Dockerfile) using Next.js `output: "standalone"`;
  runs as non-root, listens on `$PORT` (Cloud Run injects `8080`).
- **Build & deploy:** [`cloudbuild.yaml`](../cloudbuild.yaml) builds → pushes to Artifact
  Registry → `gcloud run deploy`. Or one-shot: `gcloud run deploy --source .`.
- Secrets (`MONGODB_URI`, `JWT_SECRET`) are **not** baked into the image — supplied at
  runtime via Cloud Run env vars / Secret Manager.

```bash
# one-shot build + deploy from source
gcloud run deploy sprint-management --source . --region <REGION> \
  --allow-unauthenticated --port 8080 \
  --set-env-vars "MONGODB_URI=…,JWT_SECRET=…"
```

## Config
- Database: MongoDB Atlas (Cloud Run has no local Mongo) via `MONGODB_URI`.
- Prefer `--set-secrets` (Secret Manager) over `--set-env-vars` for real secrets in prod.

## Rollback
- Cloud Run keeps revisions: roll back by routing 100% traffic to the previous revision
  (`gcloud run services update-traffic sprint-management --to-revisions <REV>=100`).
- Images are tagged with `$COMMIT_SHA` for redeploying a known-good build.
