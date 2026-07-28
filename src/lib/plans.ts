/* ------------------------------ Billing plans ------------------------------
   Subscription plans are sold per WORKSPACE and assigned by the super admin from
   the admin panel (no payment gateway yet). This file is the single source of
   truth for the tiers, their caps, and their India pricing.

   Lifecycle: a new workspace starts on a 14-day `trial` (full Business-level
   experience). The super admin then assigns a paid plan. In v1 the per-tier caps
   below are DISPLAY-ONLY — nothing is hard-blocked except (later) the trial gate.

   Prices are stored in paise (₹1 = 100 paise) and are exclusive of 18% GST. */

export const PLAN_IDS = ["trial", "pro", "business", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Free-trial length, in days. New workspaces get `trialEndsAt = now + TRIAL_DAYS`. */
export const TRIAL_DAYS = 15;

/** `Infinity` means "unlimited" for that cap. */
export interface PlanLimits {
  seats: number;
  projects: number;
  sprintsPerProject: number;
  guests: number;
  customFieldsPerProject: number;
  dashboards: number;
  storageMb: number;
  activityDays: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Short marketing line for the pricing page / admin dashboard. */
  tagline: string;
  /** Per-user monthly price, in paise. 0 for trial, null for "contact sales". */
  priceMonthly: number | null;
  /** Per-user price on annual billing (2 months free), in paise. */
  priceAnnual: number | null;
  currency: "INR";
  limits: PlanLimits;
  support: string;
  /** Tailwind-ish accent used for the plan badge in the UI. */
  color: string;
}

const UNLIMITED = Infinity;

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Trial",
    tagline: "14-day full-feature trial",
    priceMonthly: 0,
    priceAnnual: null,
    currency: "INR",
    limits: {
      seats: 15,
      projects: UNLIMITED,
      sprintsPerProject: UNLIMITED,
      guests: UNLIMITED,
      customFieldsPerProject: UNLIMITED,
      dashboards: UNLIMITED,
      storageMb: 5 * 1024,
      activityDays: 180,
    },
    support: "Email",
    color: "#8b5cf6",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For small teams getting started",
    priceMonthly: 14900, // ₹149 / user / mo
    priceAnnual: 12500, //  ₹125 / user / mo billed annually
    currency: "INR",
    limits: {
      seats: 15,
      projects: 15,
      sprintsPerProject: 5,
      guests: 5,
      customFieldsPerProject: 10,
      dashboards: 5,
      storageMb: 5 * 1024,
      activityDays: 180,
    },
    support: "Email",
    color: "#3b82f6",
  },
  business: {
    id: "business",
    name: "Business",
    tagline: "For growing teams that need room to scale",
    priceMonthly: 29900, // ₹299 / user / mo
    priceAnnual: 24900, //  ₹249 / user / mo billed annually
    currency: "INR",
    limits: {
      seats: 50,
      projects: UNLIMITED,
      sprintsPerProject: UNLIMITED,
      guests: UNLIMITED,
      customFieldsPerProject: UNLIMITED,
      dashboards: UNLIMITED,
      storageMb: 50 * 1024,
      activityDays: UNLIMITED,
    },
    support: "Priority",
    color: "#22c55e",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Custom limits, security & support",
    priceMonthly: null, // contact sales
    priceAnnual: null,
    currency: "INR",
    limits: {
      seats: UNLIMITED,
      projects: UNLIMITED,
      sprintsPerProject: UNLIMITED,
      guests: UNLIMITED,
      customFieldsPerProject: UNLIMITED,
      dashboards: UNLIMITED,
      storageMb: UNLIMITED,
      activityDays: UNLIMITED,
    },
    support: "Dedicated",
    color: "#f59e0b",
  },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  trial: "Trial",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  expired: "Expired",
};

/** Format a paise price as a rupee string, e.g. 14900 → "₹149". null → "Custom". */
export function formatPrice(paise: number | null): string {
  if (paise === null) return "Custom";
  if (paise === 0) return "Free";
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** Render an unlimited-aware cap value for display. */
export function formatLimit(n: number): string {
  return n === Infinity ? "Unlimited" : n.toLocaleString("en-IN");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The date a workspace's current entitlement lapses: trial end while trialing,
    plan expiry while active. null = never expires (active with no expiry set). */
export function entitlementEndsAt(ws: any): Date | null {
  if (!ws) return null;
  const raw = ws.subscriptionStatus === "trialing" ? ws.trialEndsAt : ws.planExpiresAt;
  return raw ? new Date(raw) : null;
}

/** Derive the effective status from the stored status + dates, treating a lapsed
    trial/plan as `expired` without needing a write. `now` is injectable for tests. */
export function resolveStatus(ws: any, now: Date = new Date()): SubscriptionStatus {
  if (!ws) return "expired";
  if (ws.subscriptionStatus === "expired") return "expired";
  const ends = entitlementEndsAt(ws);
  if (ends && ends.getTime() <= now.getTime()) return "expired";
  return ws.subscriptionStatus === "active" ? "active" : "trialing";
}

/** Whole days remaining until the entitlement lapses (0 if lapsed / no date). */
export function daysRemaining(ws: any, now: Date = new Date()): number {
  const ends = entitlementEndsAt(ws);
  if (!ends) return 0;
  const ms = ends.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
