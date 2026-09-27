"use client";

import { Calculator, Download, Ellipsis, Network, Radar, Star, Target } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Dropdown, MenuDivider, MenuItem } from "@/components/ui/Dropdown";
import { BackLink } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import type { Customer360 } from "@/lib/types";

function Sep() {
  return <span className="h-4 w-px bg-line-strong" aria-hidden="true" />;
}

export function OpenFinanceStatus({ consent }: { consent: Customer360["consent"] }) {
  if (consent.expiring > 0) return <Badge tone="amber">Consentimento expirando</Badge>;
  if (consent.active > 0) return <Badge tone="green">Open Finance ativo</Badge>;
  return <Badge tone="gray">Sem Open Finance</Badge>;
}

export function CustomerHeader({ data, onTab }: { data: Customer360; onTab: (tab: string) => void }) {
  const { customer } = data;
  const favorites = useFavorites();
  const favorite = favorites.includes(customer.customer_id);
  const exportCustomer = useMutation({ mutationFn: () => api.downloadReport("clientes", { customer_id: [customer.customer_id] }) });

  return (
    <div className="mb-4">
      <BackLink href="/clientes" />
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={customer.name} size="xl" variant="light" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-[26px] leading-tight font-bold tracking-tight text-heading">{customer.name}</h1>
              <OpenFinanceStatus consent={data.consent} />
              {data.anomaly.is_anomaly && (
                <Badge tone="violet" title={data.anomaly.reasons.join(" · ")}>
                  <Radar className="size-3.5" /> Comportamento atípico
                </Badge>
              )}
              {favorite && <Star className="size-4 fill-[#f5b301] text-[#f5b301]" aria-label="Favorito" />}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-2">
              <span className="tnum">{customer.customer_id}</span>
              <Sep />
              <span>{customer.age_range} anos</span>
              <Sep />
              <span>{customer.occupation_category}</span>
              <Sep />
              <span>{customer.state}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Dropdown
            label="Mais ações"
            width={250}
            triggerClassName="grid size-11 place-items-center rounded-lg border border-line-strong bg-white text-ink-2 hover:bg-surface-2"
            trigger={<Ellipsis className="size-5" />}
          >
            {(close) => (
              <>
                <MenuItem icon={Target} onSelect={() => {
                    onTab("oportunidades");
                    close();
                  }}>
                  Ver oportunidades
                </MenuItem>
                <MenuItem icon={Network} onSelect={() => {
                    onTab("open-finance");
                    close();
                  }}>
                  Mapa do ecossistema
                </MenuItem>
                <MenuItem icon={Download} onSelect={() => {
                    exportCustomer.mutate();
                    close();
                  }}>
                  Exportar dados (CSV)
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={Star} onSelect={() => {
                    toggleFavorite(customer.customer_id);
                    close();
                  }}>
                  {favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                </MenuItem>
              </>
            )}
          </Dropdown>
          <ButtonLink variant="primary" size="lg" href={`/simulador?customer=${customer.customer_id}`} className="h-11 px-6">
            <Calculator className="size-4" /> Gerar proposta
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
