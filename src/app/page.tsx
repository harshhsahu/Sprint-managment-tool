import Link from "next/link";
import {
  KanbanSquare, Rocket, ListChecks, GanttChartSquare, BarChart3,
  CalendarDays, SlidersHorizontal, LayoutDashboard, Users, Check, ArrowRight,
} from "lucide-react";
import { KanboWordmark, KanboIcon } from "@/components/brand";
import { PLANS, formatPrice, formatLimit, TRIAL_DAYS, type PlanId } from "@/lib/plans";
import { getSession } from "@/lib/auth";

/* ------------------------------------------------------------------ *
 * Public marketing landing page (route: "/").
 * Static server component. Pricing is derived from src/lib/plans.ts so
 * the page never drifts from the plans the admin panel actually sells.
 * ------------------------------------------------------------------ */

export const metadata = {
  title: "Kanbo — Agile task management for Indian teams",
  description:
    "Kanban boards, sprints, backlog, timeline and reports in one fast tool. Priced for Indian teams. Start a 14-day free trial — no credit card.",
};

const FEATURES = [
  { icon: KanbanSquare, title: "Kanban boards", body: "Drag-and-drop columns with WIP limits and custom statuses that match how your team really works." },
  { icon: Rocket, title: "Sprints", body: "Plan capacity, run sprints, and capture committed vs. completed points automatically at close." },
  { icon: ListChecks, title: "Backlog", body: "Groom, prioritise and pull work into sprints from a single ordered backlog." },
  { icon: GanttChartSquare, title: "Timeline", body: "See epics and dependencies on a timeline so you always know what's blocking what." },
  { icon: BarChart3, title: "Reports", body: "Burndown, velocity and throughput — the metrics that tell you if you'll ship on time." },
  { icon: CalendarDays, title: "Calendar", body: "Due dates and sprint dates on a calendar the whole team can plan around." },
  { icon: SlidersHorizontal, title: "Custom fields", body: "Add the fields your process needs — ETAs, labels, numbers — per project." },
  { icon: LayoutDashboard, title: "Dashboards", body: "Build widget dashboards for workload, status splits and upcoming deadlines." },
  { icon: Users, title: "Roles & guests", body: "Workspace roles plus per-project guest access, so clients see only what they should." },
];

// The tiers we actually sell (trial is the on-ramp, not a card).
const PRICING: { id: PlanId; popular?: boolean; blurb: string; highlights: string[] }[] = [
  {
    id: "pro",
    blurb: "For small teams getting started.",
    highlights: [
      `Up to ${formatLimit(PLANS.pro.limits.seats)} seats`,
      `${formatLimit(PLANS.pro.limits.projects)} projects`,
      `${formatLimit(PLANS.pro.limits.sprintsPerProject)} active sprints / project`,
      `${formatLimit(PLANS.pro.limits.customFieldsPerProject)} custom fields / project`,
      "5 GB storage",
      "Email support",
    ],
  },
  {
    id: "business",
    popular: true,
    blurb: "For growing teams that need room to scale.",
    highlights: [
      `Up to ${formatLimit(PLANS.business.limits.seats)} seats`,
      "Unlimited projects & sprints",
      "Unlimited guests & custom fields",
      "Unlimited dashboards",
      "50 GB storage",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    blurb: "Custom limits, security & support.",
    highlights: [
      "Unlimited everything",
      "Dedicated onboarding",
      "Custom storage & retention",
      "Dedicated support",
      "Volume pricing",
    ],
  },
];

function PriceLine({ id }: { id: PlanId }) {
  const p = PLANS[id];
  if (p.priceMonthly === null) return <span className="text-3xl font-bold">Custom</span>;
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-4xl font-bold">{formatPrice(p.priceMonthly)}</span>
      <span className="text-sm text-muted">/ user / mo</span>
    </span>
  );
}

export default async function LandingPage() {
  // Detect an existing session so logged-in visitors see "Go to app" instead of
  // the sign-in CTAs. Cookie-only check (no DB hit) — keeps the page fast.
  const session = await getSession();
  const authed = !!session;

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* ---------------------------- Header ---------------------------- */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <KanboWordmark size={30} />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Link href="/dashboard" className="btn-primary">Go to app <ArrowRight size={16} /></Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">Sign in</Link>
                <Link href="/register" className="btn-primary">Start free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ----------------------------- Hero ----------------------------- */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-[-30%] mx-auto h-[520px] max-w-4xl rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #5B8DEF, transparent)" }}
        />
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 text-center md:pt-24">
          <span className="chip mx-auto mb-5 border border-line bg-card text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {TRIAL_DAYS}-day free trial · no credit card
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Ship sprints, not spreadsheets.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Kanbo brings kanban boards, sprints, backlog, timeline and reports into one fast,
            focused workspace — priced for Indian teams.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={authed ? "/dashboard" : "/register"} className="btn-primary text-base" style={{ padding: "0.7rem 1.4rem" }}>
              {authed ? "Go to app" : "Start your free trial"} <ArrowRight size={18} />
            </Link>
            <a href="#pricing" className="btn-ghost text-base" style={{ padding: "0.7rem 1.4rem" }}>
              See pricing
            </a>
          </div>
          <p className="mt-4 text-xs text-muted">Full Business features free for {TRIAL_DAYS} days · Prices in ₹, GST invoicing</p>

          {/* Product peek — a stylised board so the hero shows the product. */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div className="card overflow-hidden p-3 shadow-2xl shadow-black/10">
              <div className="mb-3 flex items-center gap-1.5 px-1">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-muted">Kanbo · Sprint 14 board</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-left">
                {[
                  { name: "To Do", color: "#3b82f6", cards: ["Auth rate-limit", "Invoice PDF export"] },
                  { name: "In Progress", color: "#eab308", cards: ["Onboarding flow", "Board drag perf"] },
                  { name: "Done", color: "#22c55e", cards: ["Plan dashboard", "GST fields"] },
                ].map((col) => (
                  <div key={col.name} className="rounded-lg bg-background/60 p-2">
                    <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold">
                      <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                      {col.name}
                    </p>
                    <div className="space-y-2">
                      {col.cards.map((c) => (
                        <div key={c} className="card p-2.5 text-xs">
                          <p className="font-medium">{c}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="chip" style={{ background: `${col.color}22`, color: col.color }}>KAN-{c.length}</span>
                            <span className="h-4 w-4 rounded-full" style={{ background: "#5B8DEF" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Features --------------------------- */}
      <section id="features" className="border-t border-line/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Everything your sprint needs</h2>
            <p className="mt-3 text-muted">One tool from backlog to burndown — no plugins, no add-on pricing.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5 transition-colors hover:border-accent/50">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <f.icon size={20} />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- Pricing --------------------------- */}
      <section id="pricing" className="border-t border-line/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
            <p className="mt-3 text-muted">
              Start with a {TRIAL_DAYS}-day free trial of Business. Prices are per user, per month, exclusive of 18% GST.
              Save two months when you pay annually.
            </p>
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-3">
            {PRICING.map((tier) => {
              const plan = PLANS[tier.id];
              return (
                <div
                  key={tier.id}
                  className={
                    "card relative flex flex-col p-6 " +
                    (tier.popular ? "border-accent shadow-xl shadow-accent/10 lg:-mt-3 lg:pb-8" : "")
                  }
                >
                  {tier.popular && (
                    <span className="chip absolute -top-3 left-6 bg-accent text-white">Most popular</span>
                  )}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-muted">{tier.blurb}</p>
                  <div className="mt-4"><PriceLine id={tier.id} /></div>
                  {plan.priceAnnual !== null && (
                    <p className="mt-1 text-xs text-muted">or {formatPrice(plan.priceAnnual)}/user billed annually</p>
                  )}
                  <Link
                    href={tier.id === "enterprise" ? "/register" : "/register"}
                    className={(tier.popular ? "btn-primary" : "btn-ghost") + " mt-5 w-full"}
                  >
                    {tier.id === "enterprise" ? "Contact sales" : "Start free trial"}
                  </Link>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {tier.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            Every paid plan starts with the same {TRIAL_DAYS}-day free trial. Upgrade, downgrade or cancel anytime.
          </p>
        </div>
      </section>

      {/* ------------------------------ FAQ ----------------------------- */}
      <section id="faq" className="border-t border-line/60 py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">Questions, answered</h2>
          <div className="space-y-4">
            {[
              { q: "Do I need a credit card to start?", a: `No. Every workspace begins with a ${TRIAL_DAYS}-day free trial with full Business features. You only pay once you choose a plan.` },
              { q: "Are prices inclusive of GST?", a: "Prices shown are exclusive of 18% GST. We issue proper GST invoices for Indian businesses." },
              { q: "What happens when my trial ends?", a: "Your data stays safe. You pick a plan to keep working — nothing is deleted." },
              { q: "Can I change plans later?", a: "Yes — upgrade or downgrade anytime, and annual billing gives you two months free." },
            ].map((item) => (
              <div key={item.q} className="card p-5">
                <p className="font-semibold">{item.q}</p>
                <p className="mt-1.5 text-sm text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- CTA band --------------------------- */}
      <section className="border-t border-line/60 py-20">
        <div className="mx-auto max-w-4xl px-5">
          <div
            className="card overflow-hidden p-10 text-center"
            style={{ background: "linear-gradient(135deg, #5B8DEF, #3A5FD9)" }}
          >
            <h2 className="text-3xl font-bold text-white">Run your next sprint on Kanbo</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              Set up your workspace in minutes. Free for {TRIAL_DAYS} days, no card required.
            </p>
            <Link href="/register" className="btn mt-7 bg-white text-[#3A5FD9] hover:opacity-90" style={{ padding: "0.7rem 1.6rem" }}>
              Get started free <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------- Footer ---------------------------- */}
      <footer className="border-t border-line/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted sm:flex-row">
          <span className="flex items-center gap-2"><KanboIcon size={22} /> © {new Date().getFullYear()} Kanbo</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
