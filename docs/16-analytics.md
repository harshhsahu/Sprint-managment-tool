---
covers: ["src/lib/firebase/client.ts", "src/lib/apiHelpers.ts", "package.json"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 16 Analytics

## Tooling
None. No product-analytics or telemetry SDK is installed or initialised:
- `package.json` has no analytics dependency (no GA/gtag, PostHog, Mixpanel, Segment, Sentry, Vercel Analytics).
- `firebase/analytics` is never imported. `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is only passed into the Firebase config object in `src/lib/firebase/client.ts`, which by itself collects nothing.
- `Dockerfile` sets `NEXT_TELEMETRY_DISABLED=1`.

> [!TODO]
> Whether product analytics are wanted (and which events matter for a per-seat SaaS) is a product decision not expressed in the repo. Needs a human.

## Events
There are no analytics events. The closest data is the **Activity audit log** — an audit trail shown in the UI, not analytics. It is written by `src/lib/apiHelpers.ts:logActivity` into the `Activity` collection; action names are dotted `entity.verb` strings with prefixes `task.`, `sprint.`, `project.`, `workspace.`, `user.`. The action catalogue and read APIs live in [modules/10-notifications-search-activity.md](modules/10-notifications-search-activity.md) and [api/insights.md](api/insights.md). <!-- verify:ignore -->

| Event | Trigger | Properties |
|---|---|---|
| _(none)_ | — | — |

## Conventions
- Keep activity action strings stable — the UI displays them.
- Activity rows carry user/project/workspace refs and a human `detail`; don't add passwords, tokens or ID tokens to `detail` or `meta`.
- If a provider is added: initialise it client-side, mirror the activity action names, add its env vars to [15-environment-setup.md](15-environment-setup.md), and keep emails and tokens out of event properties.
