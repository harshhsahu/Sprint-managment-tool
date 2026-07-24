"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Kanban, LayoutDashboard, ListChecks, Search, Bell, Sun, Moon, LogOut,
  ChevronDown, ChevronLeft, PanelLeftClose, PanelLeftOpen, Plus, Settings, Users,
  FolderKanban, Calendar, BarChart3, Rows3, GanttChartSquare, History, User as UserIcon,
} from "lucide-react";
import { fetcher, api } from "@/lib/client";
import { Avatar, Modal } from "@/components/ui";
import { KanboWordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

/* ----------------------------- context ------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const AppCtx = createContext<{ me: Any; projects: Any[]; workspaces: Any[]; refresh: () => void }>({
  me: null, projects: [], workspaces: [], refresh: () => {},
});
export const useApp = () => useContext(AppCtx);

/* --------------------------- theme toggle --------------------------- */
/* A labeled on/off switch that lives in the sidebar. */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sm_theme", next ? "dark" : "light");
  }
  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-line/40 hover:text-foreground"
      aria-label="Toggle theme"
    >
      {dark ? <Moon size={16} /> : <Sun size={16} />}
      {dark ? "Dark mode" : "Light mode"}
      <span className={cn("ml-auto flex h-4 w-7 items-center rounded-full p-0.5 transition", dark ? "bg-accent" : "bg-line")}>
        <span className={cn("h-3 w-3 rounded-full bg-white transition", dark && "translate-x-3")} />
      </span>
    </button>
  );
}

/* --------------------------- global search -------------------------- */
function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const { data } = useSWR<Any>(open && q.length >= 2 ? `/api/search?q=${encodeURIComponent(q)}` : null, fetcher);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost hidden sm:flex !justify-start w-56 text-muted">
        <Search size={14} /> Search… <span className="ml-auto text-xs border border-line rounded px-1">/</span>
      </button>
      <button onClick={() => setOpen(true)} className="btn-ghost !p-2 sm:hidden" aria-label="Search">
        <Search size={16} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Search everything">
        <input
          className="input mb-3"
          placeholder="Search tasks, projects, sprints, people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {data?.tasks?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted">Tasks</div>
              {data.tasks.map((t: Any) => (
                <button
                  key={t._id}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line/40"
                  onClick={() => { setOpen(false); router.push(`/p/${t.project}/board?task=${t._id}`); }}
                >
                  <span className="font-mono text-xs text-muted">{t.key}</span>
                  <span className="truncate">{t.title}</span>
                  <Avatar user={t.assignee} size={18} />
                </button>
              ))}
            </div>
          )}
          {data?.projects?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted">Projects</div>
              {data.projects.map((p: Any) => (
                <button key={p._id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line/40"
                  onClick={() => { setOpen(false); router.push(`/p/${p._id}/board`); }}>
                  <FolderKanban size={14} className="text-muted" /> {p.name}
                  <span className="font-mono text-xs text-muted">{p.key}</span>
                </button>
              ))}
            </div>
          )}
          {data?.users?.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted">People</div>
              {data.users.map((u: Any) => (
                <div key={u._id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                  <Avatar user={u} size={20} /> {u.name}
                  <span className="text-xs text-muted">{u.designation || u.email}</span>
                </div>
              ))}
            </div>
          )}
          {q.length >= 2 && data && !data.tasks?.length && !data.projects?.length && !data.users?.length && (
            <p className="py-6 text-center text-sm text-muted">No results for “{q}”</p>
          )}
        </div>
      </Modal>
    </>
  );
}

/* --------------------------- notifications -------------------------- */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data, mutate } = useSWR<Any>("/api/notifications", fetcher, { refreshInterval: 30000 });
  const unread = data?.unreadCount || 0;

  async function markAll() {
    await api("/api/notifications", "PATCH", {});
    mutate();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost !p-2 relative" aria-label="Notifications">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw] card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-accent hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {(data?.notifications || []).length === 0 && (
                <p className="py-8 text-center text-sm text-muted">You&apos;re all caught up 🎉</p>
              )}
              {(data?.notifications || []).map((n: Any) => (
                <button
                  key={n._id}
                  className={cn("flex w-full gap-3 border-b border-line px-4 py-3 text-left text-sm hover:bg-line/30", !n.read && "bg-accent/5")}
                  onClick={async () => {
                    await api("/api/notifications", "PATCH", { ids: [n._id] });
                    mutate();
                    setOpen(false);
                    if (n.link) router.push(n.link);
                  }}
                >
                  <Avatar user={n.actor} size={26} />
                  <span className="min-w-0">
                    <span className={cn("block truncate", !n.read && "font-medium")}>{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                    <span className="block text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ sidebar ----------------------------- */
function NavLink({
  href, icon, label, onClose,
}: { href: string; icon: ReactNode; label: string; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        pathname === href ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-line/40 hover:text-foreground"
      )}
    >
      {icon} {label}
    </Link>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { projects, workspaces } = useApp();
  const projectMatch = pathname.match(/^\/p\/([a-f0-9]{24})/);
  const activeProjectId = projectMatch?.[1];
  // Navigating closes the sidebar only when it's a mobile overlay; on desktop it stays open.
  const closeOnNav = () => { if (typeof window !== "undefined" && window.innerWidth < 1024) onClose(); };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed z-40 flex h-full w-64 shrink-0 flex-col border-r border-line bg-card transition-all lg:static",
          open ? "translate-x-0" : "-translate-x-full lg:w-0 lg:overflow-hidden lg:border-transparent"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <KanboWordmark size={30} />
          <button className="ml-auto text-muted hover:text-foreground" onClick={onClose} aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" onClose={closeOnNav} />
          <NavLink href="/my-tasks" icon={<ListChecks size={16} />} label="My Tasks" onClose={closeOnNav} />
          <NavLink href="/workspaces" icon={<Users size={16} />} label="Workspaces" onClose={closeOnNav} />

          <div className="pt-4">
            <div className="mb-1 flex items-center justify-between px-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Projects</span>
              <Link href="/workspaces" onClick={closeOnNav} className="text-muted hover:text-accent" title="New project"><Plus size={14} /></Link>
            </div>
            {projects.map((p: Any) => (
              <div key={p._id}>
                <Link
                  href={`/p/${p._id}/board`}
                  onClick={closeOnNav}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                    activeProjectId === p._id ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-line/40 hover:text-foreground"
                  )}
                >
                  <FolderKanban size={16} />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">{p.key}</span>
                </Link>
                {activeProjectId === p._id && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-2">
                    <NavLink href={`/p/${p._id}/board`} icon={<Kanban size={14} />} label="Board" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/backlog`} icon={<Rows3 size={14} />} label="Backlog & Sprints" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/list`} icon={<ListChecks size={14} />} label="List" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/calendar`} icon={<Calendar size={14} />} label="Calendar" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/timeline`} icon={<GanttChartSquare size={14} />} label="Timeline" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/reports`} icon={<BarChart3 size={14} />} label="Reports" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/activity`} icon={<History size={14} />} label="Activity" onClose={closeOnNav} />
                    <NavLink href={`/p/${p._id}/settings`} icon={<Settings size={14} />} label="Settings" onClose={closeOnNav} />
                  </div>
                )}
              </div>
            ))}
            {projects.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted">
                No projects yet. {workspaces.length === 0 ? "Create a workspace first." : "Create one from a workspace."}
              </p>
            )}
          </div>
        </nav>

        <div className="border-t border-line p-2">
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}

/* ------------------------------ topbar ------------------------------ */
function Topbar({ sidebarOpen, onOpenSidebar }: { sidebarOpen: boolean; onOpenSidebar: () => void }) {
  const { me } = useApp();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", "POST");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-4">
      {!sidebarOpen && (
        <button className="btn-ghost !p-2" onClick={onOpenSidebar} aria-label="Open sidebar" title="Open sidebar">
          <PanelLeftOpen size={18} />
        </button>
      )}
      <button className="btn-ghost !p-2" onClick={() => router.back()} aria-label="Go back" title="Go back">
        <ChevronLeft size={18} />
      </button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <NotificationsBell />
        <div className="relative">
          <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-line/40">
            <Avatar user={me} size={28} />
            <ChevronDown size={14} className="text-muted" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-56 card p-1 shadow-xl">
                <div className="border-b border-line px-3 py-2">
                  <div className="text-sm font-medium">{me?.name}</div>
                  <div className="truncate text-xs text-muted">{me?.email}</div>
                </div>
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-line/40">
                  <UserIcon size={14} /> Profile & activity
                </Link>
                {me?.role === "super_admin" && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-line/40">
                    <Settings size={14} /> User administration
                  </Link>
                )}
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-line/40">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------- shell ------------------------------ */
export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Start collapsed on small screens (the sidebar is an overlay there).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
  }, []);
  const { data: meData } = useSWR<Any>("/api/auth/me", fetcher);
  const { data: wsData, mutate: mutWs } = useSWR<Any>("/api/workspaces", fetcher);
  const { data: projData, mutate: mutProj } = useSWR<Any>("/api/projects", fetcher);

  const ctx = {
    me: meData?.user || null,
    workspaces: wsData?.workspaces || [],
    projects: projData?.projects || [],
    refresh: () => { mutWs(); mutProj(); },
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </AppCtx.Provider>
  );
}
