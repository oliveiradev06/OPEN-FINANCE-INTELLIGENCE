"""Reference data and domain vocabulary shared by the generator, the engines and the API.

The primary institution ("Banco Aurora") is fictional — it represents the bank that operates
the platform. The other institutions are Open Finance Brasil participants used only to label
synthetic data; no real customer or bank data is used anywhere in the project.
"""

from __future__ import annotations

PRIMARY_INSTITUTION_ID = "aurora"

INSTITUTIONS: list[dict] = [
    {"institution_id": "aurora", "name": "Banco Aurora", "short_name": "Aurora", "category": "banco", "brand_color": "#10B981", "is_primary": True},
    {"institution_id": "itau", "name": "Itaú Unibanco", "short_name": "Itaú", "category": "banco", "brand_color": "#EC7000", "is_primary": False},
    {"institution_id": "bradesco", "name": "Bradesco", "short_name": "Bradesco", "category": "banco", "brand_color": "#CC092F", "is_primary": False},
    {"institution_id": "santander", "name": "Santander", "short_name": "Santander", "category": "banco", "brand_color": "#EC0000", "is_primary": False},
    {"institution_id": "bb", "name": "Banco do Brasil", "short_name": "BB", "category": "banco", "brand_color": "#F8D117", "is_primary": False},
    {"institution_id": "caixa", "name": "Caixa Econômica Federal", "short_name": "Caixa", "category": "banco", "brand_color": "#1C60AB", "is_primary": False},
    {"institution_id": "nubank", "name": "Nubank", "short_name": "Nubank", "category": "banco_digital", "brand_color": "#8A05BE", "is_primary": False},
    {"institution_id": "inter", "name": "Banco Inter", "short_name": "Inter", "category": "banco_digital", "brand_color": "#FF7A00", "is_primary": False},
    {"institution_id": "c6", "name": "C6 Bank", "short_name": "C6", "category": "banco_digital", "brand_color": "#9CA3AF", "is_primary": False},
    {"institution_id": "btg", "name": "BTG Pactual", "short_name": "BTG", "category": "investimentos", "brand_color": "#3B6FD8", "is_primary": False},
    {"institution_id": "xp", "name": "XP Investimentos", "short_name": "XP", "category": "investimentos", "brand_color": "#F2C230", "is_primary": False},
    {"institution_id": "mercadopago", "name": "Mercado Pago", "short_name": "Mercado Pago", "category": "fintech", "brand_color": "#00A6E0", "is_primary": False},
]
INSTITUTION_BY_ID = {inst["institution_id"]: inst for inst in INSTITUTIONS}

INSTITUTION_CATEGORY_LABELS = {
    "banco": "Banco",
    "banco_digital": "Banco digital",
    "investimentos": "Investimentos",
    "fintech": "Fintech",
}

# --- Products ---------------------------------------------------------------------------

ACCOUNT_TYPE_LABELS = {
    "conta_corrente": "Conta corrente",
    "poupanca": "Poupança",
    "conta_pagamento": "Conta de pagamento",
    "conta_investimento": "Conta investimento",
}

# rate = % per month. Primary reference rates are what the primary bank would offer
# in a portability proposal (used only to *inform* the analyst).
LOAN_TYPES: dict[str, dict] = {
    "rotativo_cartao": {"label": "Rotativo do cartão", "rate": (11.5, 15.5), "revolving": True},
    "cheque_especial": {"label": "Cheque especial", "rate": (6.8, 8.0), "revolving": True},
    "credito_pessoal": {"label": "Crédito pessoal", "rate": (3.9, 6.4), "term": (12, 48)},
    "consignado": {"label": "Consignado", "rate": (1.55, 2.15), "term": (24, 84)},
    "veiculo": {"label": "Financiamento de veículo", "rate": (1.45, 2.4), "term": (18, 60)},
    "imobiliario": {"label": "Financiamento imobiliário", "rate": (0.82, 1.1), "term": (120, 360)},
}
PRIMARY_REFERENCE_RATES = {
    "credito_pessoal": 3.2,
    "consignado": 1.49,
    "veiculo": 1.39,
    "imobiliario": 0.79,
}
EXPENSIVE_DEBT_RATE = 3.0  # % a.m. — above this, debt is considered "expensive"

INVESTMENT_TYPES: dict[str, dict] = {
    "cdb": {"label": "CDB", "risk": "baixo", "liquidity": "diaria", "yield": 0.0090,
            "products": ["CDB Liquidez Diária 100% CDI", "CDB 110% CDI 2028", "CDB Pré 12,8% 2027"]},
    "tesouro": {"label": "Tesouro Direto", "risk": "baixo", "liquidity": "d+1", "yield": 0.0088,
                "products": ["Tesouro Selic 2029", "Tesouro IPCA+ 2035", "Tesouro Prefixado 2028"]},
    "lci_lca": {"label": "LCI/LCA", "risk": "baixo", "liquidity": "vencimento", "yield": 0.0080,
                "products": ["LCI 92% CDI 2027", "LCA 95% CDI 2028"]},
    "fundo_rf": {"label": "Fundo de Renda Fixa", "risk": "baixo", "liquidity": "d+1", "yield": 0.0085,
                 "products": ["Fundo DI Referenciado", "Fundo RF Crédito Privado"]},
    "multimercado": {"label": "Fundo Multimercado", "risk": "moderado", "liquidity": "d+30", "yield": 0.0095,
                     "products": ["Multimercado Macro", "Multimercado Long Biased"]},
    "acoes": {"label": "Ações", "risk": "alto", "liquidity": "d+2", "yield": 0.0105,
              "products": ["Carteira de Ações", "ETF Ibovespa", "Fundo de Ações Dividendos"]},
    "previdencia": {"label": "Previdência Privada", "risk": "moderado", "liquidity": "d+30", "yield": 0.0087,
                    "products": ["PGBL Renda Fixa", "VGBL Moderado"]},
}

CARD_BRANDS = ["Visa", "Mastercard", "Elo"]

PRODUCT_LABELS = {
    "salario": "Salário",
    "conta": "Conta",
    "cartao": "Cartão",
    "investimentos": "Investimentos",
    "emprestimo": "Empréstimo",
}

# --- Transactions -------------------------------------------------------------------------

INCOME_CATEGORIES = ("salario", "renda_extra", "transferencia_recebida")
# Expenses = account debits below + every credit card purchase (transaction_type == "cartao").
# Card bill payments are not modelled as separate debits, so spending is never counted twice.
ACCOUNT_EXPENSE_CATEGORIES = ("contas_boletos", "pix_enviado", "compra_debito")
DEBT_CATEGORIES = ("parcela_emprestimo",)

CARD_SPEND_CATEGORIES: dict[str, float] = {
    "supermercado": 0.24,
    "restaurantes": 0.16,
    "transporte": 0.11,
    "compras_online": 0.13,
    "assinaturas": 0.05,
    "saude": 0.08,
    "combustivel": 0.09,
    "viagens": 0.06,
    "educacao": 0.04,
    "lazer": 0.04,
}

TRANSACTION_CATEGORY_LABELS = {
    "salario": "Salário",
    "renda_extra": "Renda extra",
    "transferencia_recebida": "Transferência recebida",
    "resgate_investimento": "Resgate de investimento",
    "liberacao_credito": "Liberação de crédito",
    "contas_boletos": "Contas e boletos",
    "pix_enviado": "PIX enviado",
    "compra_debito": "Compra no débito",
    "parcela_emprestimo": "Parcela de empréstimo",
    "aplicacao_investimento": "Aplicação em investimento",
    "supermercado": "Supermercado",
    "restaurantes": "Restaurantes",
    "transporte": "Transporte",
    "compras_online": "Compras online",
    "assinaturas": "Assinaturas digitais",
    "saude": "Saúde e farmácia",
    "combustivel": "Combustível",
    "viagens": "Viagens",
    "educacao": "Educação",
    "lazer": "Lazer",
}

# --- Opportunities ------------------------------------------------------------------------

OPPORTUNITY_TYPES: dict[str, dict] = {
    "investment": {"label": "Investimentos", "title": "Oportunidade de investimento"},
    "idle_cash": {"label": "Saldo parado", "title": "Saldo ocioso elevado"},
    "debt_optimization": {"label": "Otimização de dívida", "title": "Ineficiência financeira detectada"},
    "credit": {"label": "Crédito", "title": "Portabilidade de crédito"},
    "relationship": {"label": "Relacionamento", "title": "Relacionamento fragmentado"},
    "retention": {"label": "Retenção", "title": "Risco de evasão"},
    "spending_migration": {"label": "Migração de gastos", "title": "Gastos concentrados em cartão concorrente"},
}

OPPORTUNITY_STATUSES = {
    "new": "Nova",
    "in_review": "Em análise",
    "contacted": "Cliente contatado",
    "converted": "Convertida",
    "dismissed": "Descartada",
}

# --- Customers ----------------------------------------------------------------------------

AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]

OCCUPATIONS: dict[str, dict] = {
    # median monthly net income, lognormal sigma, month-to-month volatility, 13th salary
    "Assalariado CLT": {"weight": 0.41, "median": 5200, "sigma": 0.55, "vol": 0.03, "thirteenth": True},
    "Servidor público": {"weight": 0.12, "median": 8600, "sigma": 0.48, "vol": 0.02, "thirteenth": True},
    "Profissional liberal": {"weight": 0.12, "median": 10500, "sigma": 0.62, "vol": 0.16, "thirteenth": False},
    "Empresário": {"weight": 0.09, "median": 13500, "sigma": 0.75, "vol": 0.22, "thirteenth": False},
    "Autônomo": {"weight": 0.15, "median": 4300, "sigma": 0.55, "vol": 0.20, "thirteenth": False},
    "Aposentado": {"weight": 0.11, "median": 4900, "sigma": 0.62, "vol": 0.02, "thirteenth": True},
}

STATES: dict[str, float] = {
    "SP": 0.29, "RJ": 0.11, "MG": 0.11, "RS": 0.06, "PR": 0.06, "BA": 0.06, "SC": 0.04,
    "PE": 0.04, "CE": 0.04, "GO": 0.03, "DF": 0.03, "ES": 0.02, "PA": 0.03, "AM": 0.02,
    "MT": 0.02, "MS": 0.02, "RN": 0.01, "PB": 0.01,
}

FIRST_NAMES_M = [
    "João", "Pedro", "Lucas", "Gabriel", "Mateus", "Rafael", "Gustavo", "Felipe", "Bruno", "Rodrigo",
    "Thiago", "Daniel", "Marcelo", "André", "Eduardo", "Leonardo", "Carlos", "Fernando", "Ricardo",
    "Paulo", "Diego", "Vinícius", "Henrique", "Caio", "Renato", "Fábio", "Alexandre", "Marcos",
    "Leandro", "Sérgio", "Roberto", "José", "Antônio", "Francisco", "Luiz", "Miguel", "Arthur",
    "Heitor", "Davi", "Bernardo", "Samuel", "Otávio", "Murilo", "Igor", "Victor", "Márcio",
    "Cláudio", "Júlio", "Raul", "Hugo",
]
FIRST_NAMES_F = [
    "Maria", "Ana", "Juliana", "Fernanda", "Camila", "Amanda", "Beatriz", "Larissa", "Mariana",
    "Patrícia", "Aline", "Carolina", "Letícia", "Gabriela", "Bruna", "Renata", "Vanessa", "Débora",
    "Luciana", "Cristina", "Adriana", "Tatiana", "Sabrina", "Natália", "Isabela", "Laura", "Helena",
    "Alice", "Manuela", "Valentina", "Sofia", "Luiza", "Rafaela", "Priscila", "Simone", "Sandra",
    "Márcia", "Viviane", "Carla", "Daniela", "Paula", "Raquel", "Lívia", "Clara", "Cecília",
    "Elaine", "Rosana", "Tânia", "Bianca", "Thaís",
]
COMPOUND_M = ["Pedro", "Paulo", "Henrique", "Vitor", "Carlos", "Miguel", "Gabriel"]
COMPOUND_F = ["Carolina", "Paula", "Luiza", "Clara", "Beatriz", "Eduarda", "Fernanda"]
SURNAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima",
    "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes",
    "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques",
    "Machado", "Mendes", "Freitas", "Cardoso", "Ramos", "Gonçalves", "Santana", "Teixeira",
    "Araújo", "Pinto", "Correia", "Cavalcanti", "Monteiro", "Moura", "Batista", "Campos", "Rezende",
    "Castro", "Farias", "Tavares", "Borges", "Pires", "Azevedo", "Duarte", "Coelho", "Siqueira",
    "Queiroz", "Magalhães", "Figueiredo", "Brandão", "Peixoto", "Xavier", "Fonseca",
]

CONSENT_PURPOSE = "Análise de relacionamento e oferta de produtos adequados ao perfil financeiro"
