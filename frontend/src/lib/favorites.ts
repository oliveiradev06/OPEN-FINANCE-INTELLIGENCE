"use client";

import { useSyncExternalStore } from "react";

// Customers the analyst follows. Per browser, like a bookmark — not shared or audited.
const KEY = "ofi.favorites";
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.ids;
  }
  if (raw !== cache.raw) {
    let ids: string[] = EMPTY;
    try {
      const parsed = JSON.parse(raw ?? "[]");
      ids = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : EMPTY;
    } catch {
      ids = EMPTY;
    }
    cache = { raw, ids };
  }
  return cache.ids;
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    cache = { raw: JSON.stringify(ids), ids };
  }
  listeners.forEach((listener) => listener());
}

export function toggleFavorite(id: string) {
  const ids = read();
  write(ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]);
}

export function addFavorites(newIds: string[]) {
  const ids = read();
  write([...ids, ...newIds.filter((id) => !ids.includes(id))]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
