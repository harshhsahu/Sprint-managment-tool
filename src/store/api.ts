"use client";

/**
 * RTK Query API slice — the single source of truth for all server state.
 *
 * This replaces the previous SWR data layer. The whole server cache now lives
 * inside the Redux store, so every read/write flows through here.
 *
 * Design notes:
 * - Query endpoints are keyed by the *full request URL* (e.g. "/api/tasks?project=…").
 *   That keeps the migration from SWR mechanical: `useSWR(url, fetcher)` becomes
 *   `useGetTasksQuery(url)`, and the cache key stays identical to the old SWR key.
 * - Mutations declare `invalidatesTags`, which auto-refetches the affected lists —
 *   the RTK Query equivalent of SWR's revalidate-on-mutate.
 * - `updateTask` is optimistic: the on-screen task updates instantly (no API wait),
 *   then rolls back if the request fails. List views (board/backlog/list) layer
 *   their own optimistic `updateQueryData` patches on top for drag/inline edits.
 */

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/* ---- auth redirect (mirrors the old lib/client.ts behavior) ---- */
const AUTH_PATHS = ["/login", "/register"];
function redirectToLogin() {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return;
  const next = encodeURIComponent(pathname + search);
  window.location.href = `/login?next=${next}`;
}

/** Pull a human-readable message out of an RTK Query error object. */
export function errMsg(e: unknown): string {
  const err = e as { data?: { error?: string }; error?: string; message?: string };
  return err?.data?.error || err?.error || err?.message || "Request failed";
}

const rawBaseQuery = fetchBaseQuery({ baseUrl: "" });
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiCtx,
  extra
) => {
  const result = await rawBaseQuery(args, apiCtx, extra);
  if (result.error && result.error.status === 401) redirectToLogin();
  return result;
};

const write = (url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): FetchArgs => ({
  url,
  method,
  body,
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "Tasks", "Task", "Projects", "Project", "Sprints", "Workspaces", "Users", "Me",
    "Notifications", "Invites", "Activity", "Dashboards", "Filters", "ProjectInvites", "Reports", "Search",
  ],
  endpoints: (b) => ({
    /* ------------------------------ queries ------------------------------ */
    getTasks: b.query<Any, string>({ query: (url) => url, providesTags: ["Tasks"] }),
    getTask: b.query<Any, string>({
      query: (id) => `/api/tasks/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Task", id }],
    }),
    getProjects: b.query<Any, void>({ query: () => "/api/projects", providesTags: ["Projects"] }),
    getProject: b.query<Any, string>({
      query: (id) => `/api/projects/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Project", id }],
    }),
    getSprints: b.query<Any, string>({ query: (url) => url, providesTags: ["Sprints"] }),
    getWorkspaces: b.query<Any, void>({ query: () => "/api/workspaces", providesTags: ["Workspaces"] }),
    getUsers: b.query<Any, string>({ query: (url) => url, providesTags: ["Users"] }),
    getMe: b.query<Any, void>({ query: () => "/api/auth/me", providesTags: ["Me"] }),
    getNotifications: b.query<Any, void>({ query: () => "/api/notifications", providesTags: ["Notifications"] }),
    getInvites: b.query<Any, void>({ query: () => "/api/invites", providesTags: ["Invites"] }),
    getActivity: b.query<Any, string>({ query: (url) => url, providesTags: ["Activity"] }),
    getSearch: b.query<Any, string>({ query: (q) => `/api/search?q=${encodeURIComponent(q)}` }),
    getDashboards: b.query<Any, void>({ query: () => "/api/dashboards", providesTags: ["Dashboards"] }),
    getDashboardData: b.query<Any, void>({ query: () => "/api/dashboards/data" }),
    getReports: b.query<Any, string>({ query: (url) => url, providesTags: ["Reports"] }),
    getFilters: b.query<Any, string>({ query: (url) => url, providesTags: ["Filters"] }),
    getProjectInvites: b.query<Any, string>({ query: (url) => url, providesTags: ["ProjectInvites"] }),

    /* ------------------------------ tasks -------------------------------- */
    createTask: b.mutation<Any, Any>({
      query: (body) => write("/api/tasks", "POST", body),
      invalidatesTags: ["Tasks"],
    }),
    updateTask: b.mutation<Any, { id: string; set: Any }>({
      query: ({ id, set }) => write(`/api/tasks/${id}`, "PATCH", set),
      // Optimistic: patch the open task's cache immediately so the UI never waits.
      // Reference fields (assignee/sprint/epic/…) are sent as bare IDs but the GET
      // returns populated objects, so we skip those here and let the invalidation
      // refetch fill them in — patching a scalar over an object would flicker wrong.
      async onQueryStarted({ id, set }, { dispatch, queryFulfilled }) {
        const SKIP = new Set(["assignee", "sprint", "epic", "dependencies", "watchers", "parentTask", "reporter"]);
        const patch = dispatch(
          api.util.updateQueryData("getTask", id, (draft: Any) => {
            if (!draft?.task) return;
            for (const [k, v] of Object.entries(set)) {
              if (SKIP.has(k)) continue;
              if (k === "customFields" && v && typeof v === "object" && draft.task.customFields) {
                draft.task.customFields = { ...draft.task.customFields, ...v };
              } else {
                draft.task[k] = v;
              }
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Task", id }, "Tasks"],
    }),
    deleteTask: b.mutation<Any, string>({
      query: (id) => write(`/api/tasks/${id}`, "DELETE"),
      invalidatesTags: ["Tasks"],
    }),
    duplicateTask: b.mutation<Any, string>({
      query: (id) => write(`/api/tasks/${id}/duplicate`, "POST"),
      invalidatesTags: ["Tasks"],
    }),
    reorderTasks: b.mutation<Any, Any>({
      query: (body) => write("/api/tasks/reorder", "POST", body),
      // List views patch their own cache optimistically; no invalidation to
      // avoid a jarring refetch mid-drag.
    }),
    bulkTasks: b.mutation<Any, Any>({
      query: (body) => write("/api/tasks/bulk", "PATCH", body),
      invalidatesTags: ["Tasks"],
    }),
    addComment: b.mutation<Any, { id: string; body: string }>({
      query: ({ id, body }) => write(`/api/tasks/${id}/comments`, "POST", { body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Task", id }],
    }),
    createFieldOption: b.mutation<Any, { projectId: string; fieldId: string; name: string }>({
      query: ({ projectId, fieldId, name }) =>
        write(`/api/projects/${projectId}/field-options`, "POST", { fieldId, name }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: "Project", id: projectId }],
    }),

    /* ----------------------------- sprints ------------------------------- */
    createSprint: b.mutation<Any, Any>({
      query: (body) => write("/api/sprints", "POST", body),
      invalidatesTags: ["Sprints", "Tasks"],
    }),
    updateSprint: b.mutation<Any, { id: string; set: Any }>({
      query: ({ id, set }) => write(`/api/sprints/${id}`, "PATCH", set),
      invalidatesTags: ["Sprints", "Tasks"],
    }),
    deleteSprint: b.mutation<Any, string>({
      query: (id) => write(`/api/sprints/${id}`, "DELETE"),
      invalidatesTags: ["Sprints", "Tasks"],
    }),

    /* ---------------------------- workspaces ----------------------------- */
    createWorkspace: b.mutation<Any, Any>({
      query: (body) => write("/api/workspaces", "POST", body),
      invalidatesTags: ["Workspaces", "Projects"],
    }),
    deleteWorkspace: b.mutation<Any, string>({
      query: (id) => write(`/api/workspaces/${id}`, "DELETE"),
      invalidatesTags: ["Workspaces", "Projects"],
    }),
    inviteWorkspaceMember: b.mutation<Any, { id: string; body: Any }>({
      query: ({ id, body }) => write(`/api/workspaces/${id}/members`, "POST", body),
      invalidatesTags: ["Workspaces"],
    }),
    updateWorkspaceMember: b.mutation<Any, { id: string; userId: string; role: string }>({
      query: ({ id, userId, role }) => write(`/api/workspaces/${id}/members`, "PATCH", { userId, role }),
      invalidatesTags: ["Workspaces"],
    }),
    removeWorkspaceMember: b.mutation<Any, { id: string; userId: string }>({
      query: ({ id, userId }) => write(`/api/workspaces/${id}/members?userId=${userId}`, "DELETE"),
      invalidatesTags: ["Workspaces"],
    }),

    /* ----------------------------- projects ------------------------------ */
    createProject: b.mutation<Any, Any>({
      query: (body) => write("/api/projects", "POST", body),
      invalidatesTags: ["Projects"],
    }),
    updateProject: b.mutation<Any, { id: string; set: Any }>({
      query: ({ id, set }) => write(`/api/projects/${id}`, "PATCH", set),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Project", id }, "Projects"],
    }),
    deleteProject: b.mutation<Any, string>({
      query: (id) => write(`/api/projects/${id}`, "DELETE"),
      invalidatesTags: ["Projects"],
    }),
    updateProjectMember: b.mutation<Any, { id: string; userId: string; role: string }>({
      query: ({ id, userId, role }) => write(`/api/projects/${id}/members`, "PATCH", { userId, role }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Project", id }],
    }),
    removeProjectMember: b.mutation<Any, { id: string; userId: string }>({
      query: ({ id, userId }) => write(`/api/projects/${id}/members?userId=${userId}`, "DELETE"),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Project", id }],
    }),
    restoreProjectMember: b.mutation<Any, { id: string; userId: string }>({
      query: ({ id, userId }) => write(`/api/projects/${id}/members`, "POST", { userId }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Project", id }],
    }),
    createProjectInvite: b.mutation<Any, { id: string; email: string; role: string }>({
      query: ({ id, email, role }) => write(`/api/projects/${id}/invites`, "POST", { email, role }),
      invalidatesTags: ["ProjectInvites"],
    }),
    deleteProjectInvite: b.mutation<Any, { id: string; inviteId: string }>({
      query: ({ id, inviteId }) => write(`/api/projects/${id}/invites?inviteId=${inviteId}`, "DELETE"),
      invalidatesTags: ["ProjectInvites"],
    }),

    /* ------------------------------ users -------------------------------- */
    updateUser: b.mutation<Any, { id: string; set: Any }>({
      query: ({ id, set }) => write(`/api/users/${id}`, "PATCH", set),
      invalidatesTags: ["Users"],
    }),
    updateMe: b.mutation<Any, Any>({
      query: (body) => write("/api/auth/me", "PATCH", body),
      invalidatesTags: ["Me"],
    }),

    /* -------------------- notifications & invites ------------------------ */
    markNotifications: b.mutation<Any, Any>({
      query: (body) => write("/api/notifications", "PATCH", body ?? {}),
      invalidatesTags: ["Notifications"],
    }),
    respondInvite: b.mutation<Any, { id: string; action: "accept" | "reject" }>({
      query: ({ id, action }) => write(`/api/invites/${id}`, "PATCH", { action }),
      invalidatesTags: ["Invites", "Notifications", "Projects"],
    }),

    /* ---------------------------- dashboards ----------------------------- */
    saveDashboard: b.mutation<Any, Any>({
      query: (body) => write("/api/dashboards", "POST", body),
      invalidatesTags: ["Dashboards"],
    }),
    deleteDashboard: b.mutation<Any, string>({
      query: (id) => write(`/api/dashboards?id=${id}`, "DELETE"),
      invalidatesTags: ["Dashboards"],
    }),

    /* ------------------------------ filters ------------------------------ */
    saveFilter: b.mutation<Any, Any>({
      query: (body) => write("/api/filters", "POST", body),
      invalidatesTags: ["Filters"],
    }),

    /* ------------------------------- auth -------------------------------- */
    login: b.mutation<Any, { idToken: string }>({
      query: (body) => write("/api/auth/login", "POST", body),
    }),
    register: b.mutation<Any, { idToken: string; name: string; designation?: string; timezone?: string }>({
      query: (body) => write("/api/auth/register", "POST", body),
    }),
    logout: b.mutation<Any, void>({
      query: () => write("/api/auth/logout", "POST"),
    }),
  }),
});
