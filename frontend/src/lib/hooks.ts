"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { api } from "./api";
import { useRole } from "./role";
import type { InstitutionRef, Meta } from "./types";

const noopSubscribe = () => () => {};

/** false during SSR and hydration, true afterwards — keeps hydration output identical to the server's. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * App metadata (labels, institutions, analyst). It is shared by the shell and the pages, so it can
 * resolve before a page finishes hydrating; exposing it only after hydration avoids mismatches.
 */
export function useMeta(): { data: Meta | undefined; isLoading: boolean } {
  const role = useRole();
  const hydrated = useHydrated();
  const query = useQuery({ queryKey: ["meta", role], queryFn: api.meta, staleTime: 5 * 60_000 });
  return { data: hydrated ? query.data : undefined, isLoading: query.isLoading };
}

export function useInstitutions(): Record<string, InstitutionRef> {
  const { data } = useMeta();
  return useMemo(() => Object.fromEntries((data?.institutions ?? []).map((i) => [i.institution_id, i])), [data]);
}

export function useCan(permission: string): boolean {
  const { data } = useMeta();
  return data?.analyst.permissions.includes(permission) ?? false;
}
