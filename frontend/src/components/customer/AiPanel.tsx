"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, LoaderCircle, Lock, Send, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ApiError, api } from "@/lib/api";
import { useCan } from "@/lib/hooks";
import { useRole } from "@/lib/role";
import type { AskResponse, Customer360 } from "@/lib/types";

function SourceBadge({ source, model }: { source: "llm" | "template"; model: string | null }) {
  return source === "llm" ? (
    <Badge className="bg-violet/12 text-[#c9c3f7] ring-violet/25">
      <Sparkles className="size-3" /> LLM · {model}
    </Badge>
  ) : (
    <Badge>
      <Bot className="size-3" /> Redator determinístico (sem LLM)
    </Badge>
  );
}

export function AiPanel({ data }: { data: Customer360 }) {
  const role = useRole();
  const canUse = useCan("ai:use");
  const customerId = data.customer.customer_id;
  const [requested, setRequested] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<AskResponse[]>([]);

  const summary = useQuery({
    queryKey: ["ai-summary", customerId, role],
    queryFn: () => api.customerSummary(customerId),
    enabled: requested,
    staleTime: Infinity,
  });
  const ask = useMutation({
    mutationFn: (q: string) => api.ask(customerId, q),
    onSuccess: (answer) => setThread((items) => [...items, answer]),
  });

  const top = data.opportunities[0];
  const suggestions = [
    top ? `Por que esse cliente recebeu score ${top.score}?` : "Qual é a situação financeira do cliente?",
    "Onde estão os recursos do cliente?",
    "Quais mudanças de comportamento foram detectadas?",
    "Como está o endividamento?",
  ];
  const submit = (q: string) => {
    const text = q.trim();
    if (text.length < 3 || ask.isPending) return;
    setQuestion("");
    ask.mutate(text);
  };

  if (!canUse) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line px-4 py-5 text-[13px] text-ink-2">
        <Lock className="size-4 text-warning" /> O seu perfil não tem acesso aos recursos de IA.
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Summary */}
      <div className="rounded-xl border border-violet/20 bg-gradient-to-b from-violet/[0.07] to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <WandSparkles className="size-4 text-violet" /> AI Financial Summary
          </div>
          {summary.data && <SourceBadge source={summary.data.source} model={summary.data.model} />}
        </div>
        {!requested ? (
          <div className="mt-4">
            <p className="text-[13px] leading-relaxed text-ink-2">
              A IA recebe apenas os fatos já calculados pelos motores (scores, evidências, sinais e posições por instituição) —
              sem transações, nome ou identificadores — e os explica em linguagem natural.
            </p>
            <Button variant="ai" className="mt-4" onClick={() => setRequested(true)}>
              <Sparkles className="size-4" /> Gerar resumo
            </Button>
          </div>
        ) : summary.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-3">
            <LoaderCircle className="size-4 animate-spin" /> Organizando os fatos do cliente…
          </div>
        ) : summary.error ? (
          <p className="mt-4 text-[13px] text-[#f07171]">{summary.error instanceof ApiError ? summary.error.message : "Falha ao gerar o resumo."}</p>
        ) : summary.data ? (
          <div className="animate-fade-in">
            <p className="mt-4 text-[14px] leading-relaxed text-ink">{summary.data.summary}</p>
            {summary.data.notice && <p className="mt-3 text-[12px] text-warning">{summary.data.notice}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {summary.data.facts_used.map((fact) => (
                <Badge key={fact}>{fact}</Badge>
              ))}
            </div>
            <p className="mt-4 flex gap-2 text-[11.5px] leading-snug text-ink-3">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {summary.data.disclaimer}
            </p>
          </div>
        ) : null}
      </div>

      {/* Ask Intelligence */}
      <div className="flex flex-col rounded-xl border border-line bg-white/[0.015] p-5">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <Bot className="size-4 text-violet" /> Ask Intelligence
        </div>
        <p className="mt-1 text-[12.5px] text-ink-3">Perguntas respondidas somente com os dados deste cliente.</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={ask.isPending}
              className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-violet/40 hover:text-ink disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[340px] flex-1 space-y-4 overflow-y-auto pr-1">
          {thread.map((item, i) => (
            <div key={i} className="animate-fade-in space-y-2">
              <div className="ml-auto w-fit max-w-[90%] rounded-xl rounded-br-sm bg-surface-3 px-3 py-2 text-[13px] text-ink">{item.question}</div>
              <div className="max-w-[95%] rounded-xl rounded-bl-sm border border-violet/20 bg-violet/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                {item.answer}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <SourceBadge source={item.source} model={item.model} />
                  {item.notice && <span className="text-[11.5px] text-warning">{item.notice}</span>}
                </div>
              </div>
            </div>
          ))}
          {ask.isPending && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <LoaderCircle className="size-4 animate-spin" /> Consultando os fatos do cliente…
            </div>
          )}
          {ask.error && <div className="text-[12.5px] text-[#f07171]">{ask.error instanceof ApiError ? ask.error.message : "Falha na pergunta."}</div>}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(question);
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Pergunte sobre este cliente…"
            className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-violet/50"
          />
          <Button type="submit" variant="ai" disabled={ask.isPending || question.trim().length < 3} aria-label="Enviar pergunta">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
