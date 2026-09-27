"use client";

import { ArrowRight, BadgeCheck, Eye, EyeOff, LoaderCircle, ShieldCheck, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BuildingArt } from "@/components/layout/BuildingArt";
import { Brand } from "@/components/layout/Logo";
import { DEMO_EMAIL, safeNext, signIn } from "@/lib/session";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: UsersRound, label: "Mais clientes" },
  { icon: BadgeCheck, label: "Mais oportunidades" },
  { icon: ShieldCheck, label: "Relacionamentos mais fortes" },
];

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 22 22" className="size-5" aria-hidden="true">
      <rect x="1" y="1" width="9.5" height="9.5" fill="#F25022" />
      <rect x="11.5" y="1" width="9.5" height="9.5" fill="#7FBA00" />
      <rect x="1" y="11.5" width="9.5" height="9.5" fill="#00A4EF" />
      <rect x="11.5" y="11.5" width="9.5" height="9.5" fill="#FFB900" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("demonstracao");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<"form" | "microsoft" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  const enter = (via: "form" | "microsoft" | "google") => {
    setPending(via);
    signIn();
    router.replace(next);
  };

  // Shareable demo links (and the README screenshots) sign in directly: /login?demo=1&next=/clientes
  useEffect(() => {
    if (params.get("demo") === "1") {
      signIn();
      router.replace(next);
    }
  }, [params, next, router]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Informe um e-mail corporativo válido.");
    if (password.length < 4) return setError("Informe a sua senha.");
    setError(null);
    enter("form");
  };

  const input =
    "h-12 w-full rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] px-4 text-[15px] text-ink outline-none transition placeholder:text-[#9aa5b8] focus:border-primary/60 focus:bg-white focus:ring-3 focus:ring-primary/10";

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
      <aside className="relative hidden overflow-hidden bg-[#071a2e] lg:block">
        <BuildingArt className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#061729]/95 via-[#0a2440]/75 to-[#0a2440]/10" />
        <div className="relative flex h-full min-h-screen flex-col px-12 py-12 xl:px-16">
          <Brand size="lg" />
          <h1 className="mt-20 max-w-[390px] text-[40px] leading-[1.14] font-bold tracking-tight text-white">
            Transformando dados em novas oportunidades de negócio.
          </h1>
          <p className="mt-6 max-w-[380px] text-[17px] leading-relaxed text-white/85">
            Visão completa do ecossistema financeiro dos seus clientes, com insights de Open Finance.
          </p>
          <ul className="mt-12 space-y-5">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4 text-[16px] text-white/90">
                <span className="grid size-12 place-items-center rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-sm">
                  <Icon className="size-5 text-white" />
                </span>
                {label}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center gap-3 pt-12 text-[13px] leading-snug text-white/75">
            <ShieldCheck className="size-7 text-[#8ec2f5]" />
            <span>
              Segurança e conformidade
              <br />
              com o Open Finance
            </span>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[460px]">
          <div className="mb-10 lg:hidden">
            <span className="inline-flex rounded-xl bg-[#0c2a45] px-4 py-3">
              <Brand />
            </span>
          </div>
          <h2 className="text-[32px] leading-[1.18] font-bold tracking-tight text-heading">
            Bem-vindo ao
            <br />
            OpenFinance Intelligence
          </h2>
          <p className="mt-2 text-[16px] text-ink-2">Acesse sua conta para continuar</p>

          <form className="mt-9" onSubmit={submit} noValidate>
            <label htmlFor="email" className="text-[14px] font-semibold text-ink">
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.nome@banco.com.br"
              className={cn(input, "mt-2")}
            />

            <label htmlFor="password" className="mt-6 block text-[14px] font-semibold text-ink">
              Senha
            </label>
            <div className="relative mt-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(input, "pr-12 tracking-wide")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-2 hover:bg-surface-3"
              >
                {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
            <div className="mt-3 text-right">
              <button type="button" onClick={() => setForgot((v) => !v)} className="text-[14px] font-semibold text-primary-ink hover:underline">
                Esqueci minha senha
              </button>
            </div>
            {forgot && (
              <p className="mt-2 rounded-lg bg-primary-soft px-3.5 py-2.5 text-[13px] text-[#1d4f9e]">
                Em produção, a senha é gerenciada pelo login corporativo (SSO) do banco. Neste ambiente de demonstração qualquer senha funciona.
              </p>
            )}
            {error && <p className="mt-3 text-[13px] font-medium text-critical">{error}</p>}

            <button
              type="submit"
              disabled={pending !== null}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent-strong text-[16px] font-semibold text-white shadow-[0_1px_2px_rgb(8_131_90/0.3)] transition-colors hover:bg-[#077650] disabled:opacity-80"
            >
              {pending === "form" ? <LoaderCircle className="size-5 animate-spin" /> : null}
              Entrar
              {pending !== "form" && <ArrowRight className="size-5" />}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4 text-[13.5px] text-ink-2">
            <span className="h-px flex-1 bg-line" />
            Ou continue com
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "microsoft" as const, label: "Conta Microsoft", logo: <MicrosoftLogo /> },
              { key: "google" as const, label: "Conta Google", logo: <GoogleLogo /> },
            ].map((sso) => (
              <button
                key={sso.key}
                type="button"
                disabled={pending !== null}
                onClick={() => enter(sso.key)}
                className="flex h-12 items-center justify-center gap-2.5 rounded-lg border border-[#dfe5ee] bg-white text-[14.5px] font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-70"
              >
                {pending === sso.key ? <LoaderCircle className="size-5 animate-spin text-ink-3" /> : sso.logo}
                {sso.label}
              </button>
            ))}
          </div>
          <p className="mt-10 text-center text-[12.5px] leading-relaxed text-ink-3">
            Ambiente de demonstração com dados 100% sintéticos. O acesso é simulado: use o e-mail sugerido e qualquer senha.
          </p>
        </div>
      </main>
    </div>
  );
}
