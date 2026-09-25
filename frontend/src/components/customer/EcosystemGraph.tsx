"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { InstitutionAvatar } from "@/components/ui/InstitutionAvatar";
import { brlCompact, initials } from "@/lib/format";
import { PRODUCT_META } from "@/lib/labels";
import type { Customer360, EcosystemNode, ProductKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type InstitutionData = { node: EcosystemNode; onOpen: (id: string) => void };
type CustomerData = { name: string; assets: number; debt: number };

const centerHandle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 1, height: 1, minWidth: 1, minHeight: 1, border: 0 };

function CustomerNode({ data }: NodeProps<Node<CustomerData>>) {
  return (
    <div className="flex w-[168px] flex-col items-center text-center">
      <div className="relative grid size-[76px] place-items-center rounded-full bg-gradient-to-br from-accent/80 to-blue/80 p-[2px] shadow-[0_0_40px_-6px_rgba(16,185,129,0.55)]">
        <div className="grid size-full place-items-center rounded-full bg-[#0b1322] text-[20px] font-semibold text-ink">{initials(data.name)}</div>
      </div>
      <div className="mt-2 text-[13px] font-semibold text-ink">{data.name}</div>
      <div className="text-[11.5px] text-ink-3">
        Patrimônio <span className="font-medium text-ink-2">{brlCompact(data.assets)}</span>
      </div>
      <Handle type="source" position={Position.Top} style={centerHandle} isConnectable={false} />
    </div>
  );
}

function InstitutionNode({ data }: NodeProps<Node<InstitutionData>>) {
  const { node } = data;
  const inst = node.institution;
  const lines: string[] = [];
  if (node.account_balance > 0) lines.push(`Saldo ${brlCompact(node.account_balance)}`);
  if (node.investment_balance > 0) lines.push(`Invest. ${brlCompact(node.investment_balance)}`);
  if (node.card_spend_monthly > 0) lines.push(`Cartão ${brlCompact(node.card_spend_monthly)}/mês`);
  if (node.debt_balance > 0) lines.push(`Dívida ${brlCompact(node.debt_balance)}`);
  return (
    <button
      onClick={() => data.onOpen(inst.institution_id)}
      className={cn(
        "group w-[184px] rounded-xl border bg-[#0d1526]/95 p-3 text-left shadow-lg shadow-black/40 transition-all outline-none",
        "hover:-translate-y-0.5 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-accent/60",
        inst.is_primary ? "border-accent/50 shadow-[0_0_28px_-10px_rgba(16,185,129,0.8)]" : "border-line-strong",
      )}
    >
      <div className="flex items-center gap-2">
        <InstitutionAvatar institution={inst} size="md" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{inst.short_name}</div>
          <div className="text-[11px] text-ink-3">{inst.is_primary ? "Banco principal" : node.receives_salary ? "Recebe salário" : `${Math.round(node.share_of_assets * 100)}% do patrimônio`}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {node.products.map((p) => (
          <span key={p} className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-medium", p === "salario" ? "bg-accent/15 text-accent-soft" : "bg-white/[0.06] text-ink-2")}>
            {PRODUCT_META[p as ProductKey]?.label ?? p}
          </span>
        ))}
      </div>
      <div className="mt-2 space-y-0.5 text-[11.5px] text-ink-2">
        {lines.slice(0, 3).map((line) => (
          <div key={line} className="tnum">
            {line}
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[10.5px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">Clique para detalhar →</div>
      <Handle type="target" position={Position.Top} style={centerHandle} isConnectable={false} />
    </button>
  );
}

const nodeTypes = { customer: CustomerNode, institution: InstitutionNode };

export function EcosystemGraph({ data, onOpen }: { data: Customer360; onOpen: (institutionId: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const institutions = data.ecosystem;
    const volume = (n: EcosystemNode) => n.account_balance + n.investment_balance + n.debt_balance + n.card_spend_monthly * 12;
    const max = Math.max(...institutions.map(volume), 1);
    const count = institutions.length;
    // Ellipse just wide enough for the node cards to not overlap, so fitView keeps them legible.
    const rx = 245 + 32 * Math.max(0, count - 4);
    const ry = 196 + 22 * Math.max(0, count - 4);

    const customerNode: Node<CustomerData> = {
      id: "customer",
      type: "customer",
      position: { x: -84, y: -60 },
      data: { name: data.customer.name, assets: data.metrics.total_assets, debt: data.metrics.total_debt },
      draggable: false,
      selectable: false,
    };
    const instNodes: Node<InstitutionData>[] = institutions.map((node, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      return {
        id: node.institution.institution_id,
        type: "institution",
        position: { x: Math.cos(angle) * rx - 92, y: Math.sin(angle) * ry - 58 },
        data: { node, onOpen },
      };
    });
    const instEdges: Edge[] = institutions.map((node) => {
      const primary = node.institution.is_primary;
      return {
        id: `e-${node.institution.institution_id}`,
        source: "customer",
        target: node.institution.institution_id,
        type: "straight",
        animated: node.receives_salary,
        style: {
          stroke: primary ? "var(--color-accent)" : "var(--color-context)",
          strokeWidth: 1.5 + 5 * Math.sqrt(volume(node) / max),
          strokeOpacity: primary ? 0.9 : 0.75,
        },
      };
    });
    return { nodes: [customerNode, ...instNodes] as Node[], edges: instEdges };
  }, [data, onOpen]);

  return (
    <div className="h-full min-h-[560px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.4}
        maxZoom={1.6}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1c2842" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
