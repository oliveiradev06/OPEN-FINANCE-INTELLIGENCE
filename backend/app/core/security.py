"""Simulated analyst identity, role-based permissions and access auditing.

A real deployment would take the identity from the bank's SSO (OIDC/SAML). Here the
analyst comes from settings and the role can be switched per request with the
``X-Analyst-Role`` header, so permission checks can be demonstrated end to end.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AuditLog

ROLES: dict[str, dict] = {
    "analista": {
        "label": "Analista",
        "description": "Consulta carteira e clientes, trabalha oportunidades e usa a IA explicativa.",
        "permissions": ["portfolio:read", "customers:read", "opportunities:update", "ai:use"],
    },
    "coordenador": {
        "label": "Coordenador",
        "description": "Tudo do analista, mais governança, auditoria e execução do motor.",
        "permissions": ["portfolio:read", "customers:read", "opportunities:update", "ai:use",
                        "governance:read", "engine:run"],
    },
    "auditor": {
        "label": "Auditor",
        "description": "Somente leitura de governança e trilha de auditoria. Não acessa dados de clientes.",
        "permissions": ["portfolio:read", "governance:read"],
    },
}

PERMISSION_LABELS = {
    "portfolio:read": "Visão da carteira",
    "customers:read": "Dados de clientes (Customer 360)",
    "opportunities:update": "Atualizar status de oportunidades",
    "ai:use": "Resumos e perguntas à IA",
    "governance:read": "Governança, consentimentos e auditoria",
    "engine:run": "Executar o motor de oportunidades",
}


@dataclass
class Analyst:
    id: str
    name: str
    role: str
    permissions: list[str] = field(default_factory=list)

    @property
    def role_label(self) -> str:
        return ROLES[self.role]["label"]

    def can(self, permission: str) -> bool:
        return permission in self.permissions


def current_analyst(x_analyst_role: str | None = Header(default=None)) -> Analyst:
    settings = get_settings()
    role = (x_analyst_role or settings.default_analyst_role).lower()
    if role not in ROLES:
        role = settings.default_analyst_role
    return Analyst(settings.default_analyst_id, settings.default_analyst_name, role, list(ROLES[role]["permissions"]))


def require(permission: str):
    def dependency(analyst: Analyst = Depends(current_analyst)) -> Analyst:
        if not analyst.can(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"O perfil '{analyst.role_label}' não tem a permissão '{PERMISSION_LABELS.get(permission, permission)}'.",
            )
        return analyst

    return dependency


def audit(db: Session, analyst: Analyst, action: str, resource_type: str, resource_id: str | None,
          purpose: str, details: dict | None = None) -> None:
    """Record who accessed what, when and why (LGPD accountability)."""
    db.add(AuditLog(
        timestamp=dt.datetime.now().replace(microsecond=0), actor=analyst.id, role=analyst.role,
        action=action, resource_type=resource_type, resource_id=resource_id, purpose=purpose, details=details,
    ))
    db.commit()
