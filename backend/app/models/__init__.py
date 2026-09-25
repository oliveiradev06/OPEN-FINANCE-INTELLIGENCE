"""ORM models. Importing this package registers every table on ``Base.metadata``."""

from app.models.account import Account
from app.models.analytics import (
    BalanceSnapshot,
    BehaviorSignal,
    CustomerInstitution,
    CustomerMetrics,
    CustomerMonthlyMetric,
    InsightCustomer,
    PortfolioInsight,
    Segment,
)
from app.models.credit_card import CreditCard
from app.models.customer import Customer
from app.models.governance import AuditLog, Consent, EngineRun
from app.models.institution import Institution
from app.models.investment import Investment
from app.models.loan import Loan
from app.models.opportunity import Opportunity
from app.models.transaction import Transaction

__all__ = [
    "Account",
    "AuditLog",
    "BalanceSnapshot",
    "BehaviorSignal",
    "Consent",
    "CreditCard",
    "Customer",
    "CustomerInstitution",
    "CustomerMetrics",
    "CustomerMonthlyMetric",
    "EngineRun",
    "InsightCustomer",
    "Institution",
    "Investment",
    "Loan",
    "Opportunity",
    "PortfolioInsight",
    "Segment",
    "Transaction",
]
