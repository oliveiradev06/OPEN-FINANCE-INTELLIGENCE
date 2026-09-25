from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app import __version__
from app.api.routes import ROUTERS
from app.core.config import get_settings
from app.core.database import Base, engine
from app.pipeline.runner import database_is_empty, run_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("ofi")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    Base.metadata.create_all(engine)
    if settings.auto_seed and database_is_empty():
        logger.info("Banco vazio: gerando %s clientes sintéticos e executando os motores...", settings.seed_customers)
        run_pipeline(regenerate=True, trigger="seed")
    yield


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=(
        "Plataforma de inteligência financeira sobre dados Open Finance **sintéticos**. "
        "Consolida contas, cartões, investimentos e crédito de várias instituições, detecta oportunidades "
        "explicáveis e apoia — sem substituir — a decisão do analista."
    ),
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for router in ROUTERS:
    app.include_router(router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": settings.app_name, "version": __version__, "docs": "/docs"}
