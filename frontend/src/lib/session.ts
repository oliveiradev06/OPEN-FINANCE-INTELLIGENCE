"use client";

import { SESSION_COOKIE } from "./session-cookie";

/**
 * Simulated sign-in for the demo environment: any corporate e-mail and password open a
 * 12-hour session. A real deployment signs in through the bank's SSO (OIDC/SAML).
 */
export const DEMO_EMAIL = "ana.ribeiro@bancoaurora.com.br";

export function signIn() {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 12}; samesite=lax`;
}

export function signOut() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Only same-site paths are accepted as a post-login destination. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}
