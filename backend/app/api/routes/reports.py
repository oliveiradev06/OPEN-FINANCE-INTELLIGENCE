"""CSV reports. Each export checks the analyst's permission and is written to the audit trail,
because data leaving the platform is exactly what LGPD accountability is about."""

from __future__ import annotations

import csv
import datetime as dt
import io
from collections.abc import Callable, Iterable

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.customers import CustomerFilters, consent_status_by_customer, customer_filters, filter_conditions
from app.api.routes.institutions import aggregate_by_institution
from app.core.database import get_db
from app.core.security import PERMISSION_LABELS, Analyst, audit, current_analyst, require
from app.data import reference as ref
from app.models import (
    AuditLog,
    Consent,
    Customer,
    CustomerMetrics,
    Opportunity,
    PortfolioInsight,
)
from app.services.serializers import band_label

router = APIRouter(prefix="/api/reports", tags=["reports"])

Rows = tuple[list[str], Iterable[list]]

PRIORITY_LABELS = {"high": "Alta", "medium": "Média", "low": "Baixa"}
CONSENT_LABELS = {"active": "Ativo", "expiring": "Expirando", "revoked": "Revogado"}


def _money(value: float | None) -> str:
    """Two decimals with a decimal comma, the way Excel in pt-BR reads numbers."""
    return f"{(value or 0.0):.2f}".replace(".", ",")


def _ratio(value: float | None) -> str:
    return f"{(value or 0.0) * 100:.1f}".replace(".", ",")


def _when(value: dt.datetime | dt.date | None) -> str:
    if value is None:
        return ""
    return value.strftime("%d/%m/%Y %H:%M") if isinstance(value, dt.datetime) else value.strftime("%d/%m/%Y")


def _opportunities(db: Session, type_: str | None, priority: str | None, status: str | None) -> Rows:
    stmt = (select(Opportunity, Customer.name, Customer.segment)
            .join(Customer, Customer.customer_id == Opportunity.customer_id)
            .order_by(Opportunity.score.desc(), Opportunity.estimated_value.desc()))
    if type_:
        stmt = stmt.where(Opportunity.type == type_)
    if priority:
        stmt = stmt.where(Opportunity.priority == priority)
    if status:
        stmt = stmt.where(Opportunity.status == status)
    header = ["Oportunidade", "Cliente (ID)", "Cliente", "Segmento", "Tipo", "Título", "Score", "Prioridade",
              "Valor estimado (R$)", "Status", "Detectada em", "Principal evidência"]
    rows = ([o.opportunity_id, o.customer_id, name, segment, ref.OPPORTUNITY_TYPES[o.type]["label"], o.title, o.score,
             PRIORITY_LABELS.get(o.priority, o.priority), _money(o.estimated_value),
             ref.OPPORTUNITY_STATUSES.get(o.status, o.status), _when(o.created_at),
             next((e["text"] for e in o.evidence if e["kind"] == "support"), "")]
            for o, name, segment in db.execute(stmt))
    return header, rows


def _priority_customers(db: Session) -> Rows:
    stmt = (select(CustomerMetrics, Customer.name, Customer.segment)
            .join(Customer, Customer.customer_id == CustomerMetrics.customer_id)
            .where(CustomerMetrics.opportunity_score >= 80)
            .order_by(CustomerMetrics.opportunity_score.desc(), CustomerMetrics.opportunity_value.desc()))
    header = ["Cliente (ID)", "Cliente", "Segmento", "Opportunity Score", "Oportunidade principal", "Oportunidades",
              "Valor em oportunidades (R$)", "Saúde financeira", "Faixa", "Patrimônio (R$)", "Dívidas (R$)", "Instituições"]
    rows = ([m.customer_id, name, segment, m.opportunity_score,
             ref.OPPORTUNITY_TYPES[m.top_opportunity_type]["label"] if m.top_opportunity_type else "",
             m.opportunities_count, _money(m.opportunity_value), m.health_score, band_label(m.health_band),
             _money(m.total_assets), _money(m.total_debt), m.institutions_count]
            for m, name, segment in db.execute(stmt))
    return header, rows


def _institutions(db: Session) -> Rows:
    stats = aggregate_by_institution(db)
    total_assets = sum(s["account_balance"] + s["investment_balance"] for s in stats.values()) or 1.0
    header = ["Instituição", "Categoria", "Banco principal", "Clientes", "Com salário", "Saldos (R$)", "Investimentos (R$)",
              "Dívidas (R$)", "Cartão por mês (R$)", "Participação no patrimônio (%)"]
    rows = []
    for inst in ref.INSTITUTIONS:
        s = stats.get(inst["institution_id"])
        if not s:
            continue
        assets = s["account_balance"] + s["investment_balance"]
        rows.append([inst["name"], ref.INSTITUTION_CATEGORY_LABELS[inst["category"]], "Sim" if inst["is_primary"] else "Não",
                     s["customers"], s["salary_customers"], _money(s["account_balance"]), _money(s["investment_balance"]),
                     _money(s["debt_balance"]), _money(s["card_spend_monthly"]), _ratio(assets / total_assets)])
    return header, rows


def _insights(db: Session) -> Rows:
    header = ["Posição", "Categoria", "Tipo", "Título", "Descrição", "Valor", "Clientes afetados", "Gerado em"]
    rows = ([i.rank, i.category, i.severity, i.title, i.description,
             _ratio(i.headline_value) + "%" if i.headline_format == "percent" else _money(i.headline_value),
             i.affected_customers, _when(i.generated_at)]
            for i in db.scalars(select(PortfolioInsight).order_by(PortfolioInsight.rank)))
    return header, rows


def _consents(db: Session) -> Rows:
    header = ["Consentimento", "Cliente (ID)", "Instituição", "Status", "Escopos", "Concedido em", "Expira em",
              "Última sincronização"]
    rows = ([c.consent_id, c.customer_id, ref.INSTITUTION_BY_ID[c.institution_id]["name"], CONSENT_LABELS.get(c.status, c.status),
             ", ".join(c.scopes), _when(c.granted_at), _when(c.expires_at), _when(c.last_sync_at)]
            for c in db.scalars(select(Consent).order_by(Consent.customer_id, Consent.institution_id)))
    return header, rows


def _audit(db: Session) -> Rows:
    header = ["Data/hora", "Analista", "Perfil", "Ação", "Tipo de recurso", "Recurso", "Finalidade"]
    rows = ([_when(log.timestamp), log.actor, log.role, log.action, log.resource_type, log.resource_id or "", log.purpose]
            for log in db.scalars(select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(5000)))
    return header, rows


REPORTS: dict[str, dict] = {
    "clientes": {  # served by export_customers, which also accepts the list filters
        "title": "Carteira de clientes",
        "description": "Todos os clientes com renda, patrimônio, dívidas, saúde financeira, score e status do Open Finance.",
        "permission": "customers:read",
        "build": None,
        "count": lambda db: db.scalar(select(func.count()).select_from(CustomerMetrics)),
    },
    "oportunidades": {
        "title": "Oportunidades da carteira",
        "description": "Todas as oportunidades detectadas pelo motor, com score, prioridade, valor, status e a evidência principal.",
        "permission": "customers:read",
        "build": _opportunities,
        "count": lambda db: db.scalar(select(func.count()).select_from(Opportunity)),
    },
    "clientes-prioritarios": {
        "title": "Clientes prioritários",
        "description": "Clientes com Opportunity Score a partir de 80, com oportunidade principal, saúde financeira e patrimônio.",
        "permission": "customers:read",
        "build": _priority_customers,
        "count": lambda db: db.scalar(select(func.count()).select_from(CustomerMetrics).where(CustomerMetrics.opportunity_score >= 80)),
    },
    "instituicoes": {
        "title": "Participação por instituição",
        "description": "Clientes, saldos, investimentos, dívidas e gasto com cartão da carteira em cada instituição.",
        "permission": "portfolio:read",
        "build": _institutions,
        "count": lambda db: len(aggregate_by_institution(db)),
    },
    "insights": {
        "title": "Insights da carteira",
        "description": "Os insights gerados na última execução do motor, com o número de clientes por trás de cada um.",
        "permission": "portfolio:read",
        "build": _insights,
        "count": lambda db: db.scalar(select(func.count()).select_from(PortfolioInsight)),
    },
    "consentimentos": {
        "title": "Consentimentos Open Finance",
        "description": "Consentimentos por cliente e instituição, com escopos, status e datas. Traz só o ID do cliente.",
        "permission": "governance:read",
        "build": _consents,
        "count": lambda db: db.scalar(select(func.count()).select_from(Consent)),
    },
    "auditoria": {
        "title": "Trilha de auditoria",
        "description": "Acessos a clientes, uso de IA, mudanças de status, exportações e execuções do motor.",
        "permission": "governance:read",
        "build": _audit,
        "count": lambda db: db.scalar(select(func.count()).select_from(AuditLog)),
    },
}


@router.get("", dependencies=[Depends(require("portfolio:read"))])
def list_reports(db: Session = Depends(get_db), analyst: Analyst = Depends(current_analyst)) -> list[dict]:
    last_exports = dict(db.execute(
        select(AuditLog.resource_id, func.max(AuditLog.timestamp))
        .where(AuditLog.action == "report.export").group_by(AuditLog.resource_id)
    ).all())
    return [{
        "key": key, "title": r["title"], "description": r["description"], "format": "csv",
        "permission": r["permission"], "permission_label": PERMISSION_LABELS[r["permission"]],
        "available": analyst.can(r["permission"]), "rows": int(r["count"](db) or 0),
        "last_export": last_exports.get(key),
    } for key, r in REPORTS.items()]


CONSENT_STATUS_LABELS = {"active": "Ativo", "expiring": "Expirando", "revoked": "Revogado", "none": "Sem consentimento"}


def _csv_response(header: list[str], rows: Iterable[list], filename: str) -> tuple[Response, int]:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(header)
    count = 0
    for row in rows:
        writer.writerow(row)
        count += 1
    response = Response(
        content="﻿" + buffer.getvalue(),  # BOM: Excel opens the accents correctly
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
    return response, count


@router.get("/clientes")
def export_customers(
    filters: CustomerFilters = Depends(customer_filters),
    db: Session = Depends(get_db),
    analyst: Analyst = Depends(require("customers:read")),
) -> Response:
    """The customer list exactly as filtered on screen (or a selection, via customer_id)."""
    cm = CustomerMetrics
    stmt = (select(cm, Customer).join(Customer, Customer.customer_id == cm.customer_id)
            .where(*filter_conditions(db, filters)).order_by(cm.opportunity_score.desc(), cm.customer_id))
    rows = db.execute(stmt).all()
    consent = consent_status_by_customer(db, [m.customer_id for m, _ in rows])
    header = ["Cliente (ID)", "Cliente", "Segmento", "Faixa etária", "Ocupação", "UF", "Renda mensal (R$)", "Patrimônio (R$)",
              "Dívidas (R$)", "Endividamento", "Saúde financeira", "Faixa", "Opportunity Score", "Oportunidade principal",
              "Oportunidades", "Valor em oportunidades (R$)", "Instituições", "Status Open Finance", "Mudanças de comportamento"]
    debt_labels = {"low": "Baixo", "moderate": "Moderado", "high": "Alto"}
    body = ([m.customer_id, c.name, c.segment, c.age_range, c.occupation_category, c.state, _money(m.monthly_income),
             _money(m.total_assets), _money(m.total_debt), debt_labels.get(m.debt_level, m.debt_level), m.health_score,
             band_label(m.health_band), m.opportunity_score,
             ref.OPPORTUNITY_TYPES[m.top_opportunity_type]["label"] if m.top_opportunity_type else "", m.opportunities_count,
             _money(m.opportunity_value), m.institutions_count, CONSENT_STATUS_LABELS[consent[m.customer_id]], m.signals_count]
            for m, c in rows)
    response, count = _csv_response(header, body, f"clientes-{dt.date.today().isoformat()}.csv")
    applied = {k: v for k, v in vars(filters).items() if v not in (None, [], "")}
    audit(db, analyst, "report.export", "report", "clientes", "Exportação de relatório para análise interna",
          {"rows": count, **({"filters": applied} if applied else {})})
    return response


@router.get("/{key}")
def export_report(
    key: str,
    type: str | None = Query(None, description="Oportunidades: filtra pelo tipo"),  # noqa: A002
    priority: str | None = Query(None, description="Oportunidades: high | medium | low"),
    status: str | None = Query(None, description="Oportunidades: status do workflow"),
    db: Session = Depends(get_db),
    analyst: Analyst = Depends(current_analyst),
) -> Response:
    report = REPORTS.get(key)
    if report is None:
        raise HTTPException(status_code=404, detail="Relatório não encontrado.")
    if not analyst.can(report["permission"]):
        raise HTTPException(status_code=403, detail=(f"O perfil '{analyst.role_label}' não tem a permissão "
                                                     f"'{PERMISSION_LABELS[report['permission']]}'."))
    build: Callable = report["build"]
    header, rows = build(db, type, priority, status) if key == "oportunidades" else build(db)
    response, count = _csv_response(header, rows, f"{key}-{dt.date.today().isoformat()}.csv")
    filters = {k: v for k, v in {"type": type, "priority": priority, "status": status}.items() if v and key == "oportunidades"}
    audit(db, analyst, "report.export", "report", key, "Exportação de relatório para análise interna",
          {"rows": count, **({"filters": filters} if filters else {})})
    return response
