"""pt-BR number formatting used in evidence texts, insights and AI fact sheets."""

from __future__ import annotations

import datetime as dt
import unicodedata

MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
MONTHS_PT_FULL = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def _swap_separators(text: str) -> str:
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def number(value: float, decimals: int = 0) -> str:
    return _swap_separators(f"{value:,.{decimals}f}")


def brl(value: float, decimals: int = 0) -> str:
    """R$ 12.345 (or R$ 12.345,67 with decimals=2)."""
    sign = "-" if value < 0 else ""
    return f"{sign}R$ {number(abs(value), decimals)}"


def brl_compact(value: float) -> str:
    """R$ 850 · R$ 28,4 mil · R$ 2,4 mi · R$ 1,3 bi."""
    sign = "-" if value < 0 else ""
    v = abs(value)
    if v >= 1e9:
        text = f"{number(v / 1e9, 1)} bi"
    elif v >= 1e6:
        text = f"{number(v / 1e6, 1)} mi"
    elif v >= 1e4:
        text = f"{number(v / 1e3, 1)} mil"
    else:
        text = number(v, 0)
    return f"{sign}R$ {text.replace(',0 ', ' ')}"


def pct(ratio: float, decimals: int = 0, signed: bool = False) -> str:
    """0.184 -> '18%'; signed=True -> '+18%'."""
    value = ratio * 100
    text = number(abs(value), decimals) + "%"
    if signed:
        return ("+" if value >= 0 else "-") + text
    return ("-" if value < 0 else "") + text


def rate(value: float) -> str:
    """Monthly interest rate: 5.4 -> '5,4% a.m.'"""
    return f"{number(value, 2 if value < 1 else 1)}% a.m."


def month_label(month: dt.date | str, full: bool = False) -> str:
    if isinstance(month, str):
        month = dt.date.fromisoformat(month[:10])
    names = MONTHS_PT_FULL if full else MONTHS_PT
    return f"{names[month.month - 1]}/{str(month.year)[2:]}" if not full else f"{names[month.month - 1]} de {month.year}"


def plural(n: int, singular: str, plural_form: str | None = None) -> str:
    return f"{number(n)} {singular if n == 1 else (plural_form or singular + 's')}"


def normalize_text(text: str) -> str:
    """Lowercase, accent-free text for search ("João" -> "joao")."""
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()
