"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { InsightCard } from "@/components/insights/InsightCard";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import { dateTimeBR } from "@/lib/format";
import { INSIGHT_CATEGORY } from "@/lib/labels";
import { useRole } from "@/lib/role";

export default function InsightsPage() {
  const role = useRole();
  const [category, setCategory] = useState("all");
  const { data, error } = useQuery({ queryKey: ["insights", role], queryFn: api.insights });
  const exportInsights = useMutation({ mutationFn: () => api.downloadReport("insights") });

  if (error) return <ErrorState error={error} className="mt-24" />;
  const categories = Array.from(new Set((data ?? []).map((i) => i.category)));
  const shown = (data ?? []).filter((i) => category === "all" || i.category === category);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Insights"
        description={
          data?.[0]
            ? `Gerados pelo motor em ${dateTimeBR(data[0].generated_at)}. Cada número vem com a lista exata de clientes que o compõem.`
            : "Gerados automaticamente a cada execução do motor."
        }
        actions={
          <Button variant="secondary" onClick={() => exportInsights.mutate()} disabled={exportInsights.isPending || !data}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        }
      />
      <Tabs
        className="mb-5"
        value={category}
        onChange={setCategory}
        items={[
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
