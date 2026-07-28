import { AVATAR_COLORS } from "./constants";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Everyone who can be assigned tasks on a project: the workspace owner + all
    workspace members (they get access to every project automatically) + project
    guests, deduplicated, minus anyone the admin has excluded from this project.
    Expects a project populated with `workspace.owner`, `workspace.members.user`,
    `members.user`, and `excludedMembers`. */
export function projectAssignees(project: any): { user: any; role: string }[] {
  if (!project) return [];
  const excluded = new Set(
    (project.excludedMembers || []).map((e: any) => String(e?._id ?? e))
  );
  const out: { user: any; role: string }[] = [];
  const seen = new Set<string>();
  const push = (user: any, role: string) => {
    const id = user?._id && String(user._id);
    if (!id || seen.has(id) || excluded.has(id)) return;
    seen.add(id);
    out.push({ user, role });
  };
  const owner = project.workspace?.owner;
  if (owner) push(owner, "owner");
  for (const m of project.workspace?.members || []) push(m.user, m.role);
  for (const m of project.members || []) push(m.user, m.role);
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function formatDate(d?: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function isOverdue(d?: string | Date | null): boolean {
  if (!d) return false;
  const due = new Date(d);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}
