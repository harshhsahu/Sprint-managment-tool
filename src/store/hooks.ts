"use client";

/**
 * SWR-compatible wrappers around the RTK Query hooks.
 *
 * The rest of the app was written against SWR's `{ data, mutate, isLoading }`
 * shape, so these thin adapters keep call sites almost identical during the
 * migration: `useSWR(url, fetcher)` → `useQ.tasks(url)`.
 *
 * Two behaviors are preserved from SWR:
 *  - conditional fetching: pass `null`/`undefined` and the request is skipped;
 *  - keepPreviousData: the last non-empty result is retained while a new arg loads,
 *    so filtering/paging doesn't flash a spinner.
 */

import { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { api } from "./api";
import type { AppDispatch, RootState, AppStore } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type QueryResult = { data: Any; isLoading: boolean; refetch: () => Any };
interface SwrLike {
  data: Any;
  isLoading: boolean;
  mutate: () => void;
}

/**
 * Adapt an RTK Query result to SWR's `{ data, mutate, isLoading }`, with
 * keepPreviousData. The previous non-empty result is held in state and adjusted
 * during render (the same render-phase state pattern used elsewhere in this
 * codebase) so switching filters/pages doesn't flash a spinner.
 */
function useSwrLike(result: QueryResult): SwrLike {
  const [kept, setKept] = useState<Any>(result.data);
  if (result.data !== undefined && result.data !== kept) setKept(result.data);
  const data = result.data !== undefined ? result.data : kept;
  return {
    data,
    isLoading: result.isLoading && data === undefined,
    mutate: result.refetch,
  };
}

type Opts = { pollingInterval?: number };

/** SWR-style query accessors. Each is a real hook (note the `use*` names). */
export const useQ = {
  useTasks: (url: string | null | undefined) =>
    useSwrLike(api.useGetTasksQuery(url ?? skipToken)),
  useTask: (id: string | null | undefined) =>
    useSwrLike(api.useGetTaskQuery(id ?? skipToken)),
  useProjects: () => useSwrLike(api.useGetProjectsQuery()),
  useProject: (id: string | null | undefined) =>
    useSwrLike(api.useGetProjectQuery(id ?? skipToken)),
  useSprints: (url: string | null | undefined) =>
    useSwrLike(api.useGetSprintsQuery(url ?? skipToken)),
  useWorkspaces: () => useSwrLike(api.useGetWorkspacesQuery()),
  useUsers: (url: string | null | undefined) =>
    useSwrLike(api.useGetUsersQuery(url ?? skipToken)),
  useMe: () => useSwrLike(api.useGetMeQuery()),
  useNotifications: (opts?: Opts) =>
    useSwrLike(api.useGetNotificationsQuery(undefined, opts)),
  useInvites: (opts?: Opts) => useSwrLike(api.useGetInvitesQuery(undefined, opts)),
  useActivity: (url: string | null | undefined) =>
    useSwrLike(api.useGetActivityQuery(url ?? skipToken)),
  useSearch: (q: string | null | undefined) =>
    useSwrLike(api.useGetSearchQuery(q ?? skipToken)),
  useDashboards: () => useSwrLike(api.useGetDashboardsQuery()),
  useDashboardData: (opts?: Opts) =>
    useSwrLike(api.useGetDashboardDataQuery(undefined, opts)),
  useReports: (url: string | null | undefined) =>
    useSwrLike(api.useGetReportsQuery(url ?? skipToken)),
  useFilters: (url: string | null | undefined) =>
    useSwrLike(api.useGetFiltersQuery(url ?? skipToken)),
  useProjectInvites: (url: string | null | undefined) =>
    useSwrLike(api.useGetProjectInvitesQuery(url ?? skipToken)),
};

// Re-export the generated mutation hooks under friendly names.
export const {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useDuplicateTaskMutation,
  useReorderTasksMutation,
  useBulkTasksMutation,
  useAddCommentMutation,
  useCreateFieldOptionMutation,
  useCreateSprintMutation,
  useUpdateSprintMutation,
  useDeleteSprintMutation,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useInviteWorkspaceMemberMutation,
  useUpdateWorkspaceMemberMutation,
  useRemoveWorkspaceMemberMutation,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useUpdateProjectMemberMutation,
  useRemoveProjectMemberMutation,
  useCreateProjectInviteMutation,
  useDeleteProjectInviteMutation,
  useUpdateUserMutation,
  useUpdateMeMutation,
  useMarkNotificationsMutation,
  useRespondInviteMutation,
  useSaveDashboardMutation,
  useDeleteDashboardMutation,
  useSaveFilterMutation,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} = api;
