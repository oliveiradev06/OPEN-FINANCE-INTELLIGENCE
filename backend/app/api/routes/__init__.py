from app.api.routes import analytics, customers, governance, insights, institutions, meta, opportunities, portfolio

ROUTERS = [
    meta.router,
    portfolio.router,
    customers.router,
    opportunities.router,
    insights.router,
    institutions.router,
    analytics.router,
    governance.router,
]
