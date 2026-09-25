"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { InsightCard } from "@/components/insights/InsightCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { dateTimeBR } from "@/lib/format";
import { INSIGHT_CATEGORY } from "@/lib/labels";
import { useRole } from "@/lib/role";

export default function InsightsPage() {
  const role = useRole();
  const [category, setCategory] = useState("all");
  const { data, error } = useQuery({ queryKey: ["insights", role], queryFn: api.insights });

  if (error) return <ErrorState error={error} className="mt-24" />;
  const categories = Array.from(new Set((data ?? []).map((i) => i.category)));
  const shown = (data ?? []).filter((i) => category === "all" || i.category === category);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Inteligência da carteira"
        title="Insights"
        description={
          data?.[0]
            ? `Gerados automaticamente pelo motor em ${dateTimeBR(data[0].generated_at)}. Cada número vem com a lista exata de clientes que o compõem.`
            : "Gerados automaticamente a cada execução do motor."
        }
      />
      <Segmented
        className="mb-4"
        value={category}
        onChange={setCategory}
        options={[
          { value: "all", label: "Todos", count: data?.length },
          ...categories.map((c) => ({ value: c, label: INSIGHT_CATEGORY[c] ?? c, count: data?.filter((i) => i.category === c).length })),
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data
          ? shown.map((insight) => <InsightCard key={insight.insight_id} insight={insight} />)
          : Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    </div>
  );
}
