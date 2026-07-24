# 15 Environment Setup

## Prerequisites
- Node.js 22.x, npm
- MongoDB — local, Docker (`docker run -d --name sprint-mongo -p 27017:27017 mongo:7`), or MongoDB Atlas

## Install & Run
```bash
npm install
cp .env.example .env.local     # fill MONGODB_URI + JWT_SECRET
npm run seed                   # optional: demo workspace/project/sprints/tasks
npm run dev                    # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run seed`.

## Environment Variables
| Var | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | yes | secret for signing the `sm_session` JWT — change in production |

Copy `.env.example` → `.env.local` and fill in. Never commit real secrets (`.env*` is
git-ignored except `.env.example`).

## Notes
- The **first** registered account becomes `super_admin`.
- Demo accounts after `npm run seed` (password `password123`): `alice@demo.dev` (super
  admin / project admin), `bob@demo.dev` (team lead), `dave@demo.dev` (developer),
  `carol@demo.dev` (QA), `erin@demo.dev` (viewer).
- The app does not degrade without the DB — if `MONGODB_URI` is unreachable, API calls
  return errors and the UI shows error/empty states.
