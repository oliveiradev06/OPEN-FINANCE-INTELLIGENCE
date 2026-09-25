"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "./types";

// Simulated analyst role (sent as X-Analyst-Role). Real deployments take it from SSO.
const KEY = "ofi.role";
const DEFAULT_ROLE: Role = "analista";
const listeners = new Set<() => void>();

export function getRole(): Role {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "analista" || stored === "coordenador" || stored === "auditor" ? stored : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

export function setRole(role: Role) {
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    /* storage unavailable: role lasts for this tab only */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRole(): Role {
  return useSyncExternalStore(subscribe, getRole, () => DEFAULT_ROLE);
}
