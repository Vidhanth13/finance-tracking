"""Parse bank-notification emails into structured transactions.

Designed as a reusable financial-data layer: the `Transaction` shape and the
parsers here are meant to outlive gmail-brief and feed a dedicated expenditure
tracker. Add a parser per bank; keep the output shape stable.

Currently supported: Discovery Bank transaction-update emails.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12, "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7,
    "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Payment-processor prefixes to strip when normalising a merchant name.
_PROCESSOR_PREFIXES = ("dl*", "yoco *", "yoco*", "payfast*", "sp ", "sumup *", "zap*")


@dataclass
class Transaction:
    source: str                 # e.g. "discovery_bank"
    txn_type: str               # card_payment | transfer | card_declined
    status: str                 # posted | declined
    direction: str              # debit | credit
    amount: float               # always >= 0; direction carries the sign
    currency: str               # ISO code, e.g. "ZAR"
    merchant_raw: str | None    # as printed by the bank
    merchant: str | None        # cleaned/normalised
    account_ref: str | None     # bank-masked last 4 (already masked by the bank)
    occurred_at: str | None     # ISO 8601 local time
    category: str | None = None # left for later classification / the tracker


def _amount(raw: str) -> float:
    return float(raw.replace(",", "").replace(" ", ""))


def _normalise_merchant(raw: str) -> str:
    m = raw.strip()
    low = m.lower()
    for pre in _PROCESSOR_PREFIXES:
        if low.startswith(pre):
            m = m[len(pre):].strip()
            break
    # Drop trailing reference codes / region tails ("... 158569 CE", "... ZA").
    m = re.sub(r"\s+(?:[A-Z]{2}|\d{4,})$", "", m).strip()
    return " ".join(w.capitalize() if w.isupper() or w.islower() else w for w in m.split())


def _occurred_at(text: str, year: int) -> str | None:
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+at\s+(\d{1,2}):(\d{2})", text)
    if not m:
        return None
    day, mon, hh, mm = m.group(1), m.group(2).lower(), int(m.group(3)), int(m.group(4))
    month = _MONTHS.get(mon)
    if not month:
        return None
    try:
        return datetime(year, month, int(day), hh, mm).isoformat(timespec="minutes")
    except ValueError:
        return None


def _year_from_internal_date(internal_date_ms: str | int | None) -> int:
    try:
        return datetime.fromtimestamp(int(internal_date_ms) / 1000).year
    except (TypeError, ValueError):
        return datetime.now().year


def parse_discovery(snippet: str, internal_date_ms: str | int | None = None) -> list[Transaction]:
    """Parse a Discovery Bank transaction-update snippet. Returns 0..1 txns."""
    if not snippet:
        return []
    year = _year_from_internal_date(internal_date_ms)
    when = _occurred_at(snippet, year)

    # Transfer between accounts.
    mt = re.search(
        r"Transfer\s+R\s*([\d,]+\.\d{2})\s+From account ending \*+(\d{3,4})"
        r"\s+To account ending \*+(\d{3,4})",
        snippet, re.I,
    )
    if mt:
        return [Transaction(
            source="discovery_bank", txn_type="transfer", status="posted",
            direction="debit", amount=_amount(mt.group(1)), currency="ZAR",
            merchant_raw=None, merchant=f"Transfer to ***{mt.group(3)}",
            account_ref=mt.group(2), occurred_at=when,
        )]

    # Card payment or declined card.
    mc = re.search(
        r"Card (payment|declined)\s+(.+?)\s+[–-]\s+R\s*([\d,]+\.\d{2})",
        snippet, re.I,
    )
    if mc:
        declined = mc.group(1).lower() == "declined"
        raw = mc.group(2).strip()
        acct = re.search(r"(?:Card ending|account ending)\s*\*+(\d{3,4})", snippet, re.I)
        return [Transaction(
            source="discovery_bank",
            txn_type="card_declined" if declined else "card_payment",
            status="declined" if declined else "posted",
            direction="debit", amount=_amount(mc.group(3)), currency="ZAR",
            merchant_raw=raw, merchant=_normalise_merchant(raw),
            account_ref=acct.group(1) if acct else None, occurred_at=when,
        )]
    return []


# Registry: map a sender-domain fragment to its parser.
_PARSERS = {"discovery.bank": parse_discovery}


def parse(sender: str, snippet: str, internal_date_ms: str | int | None = None) -> list[Transaction]:
    low = (sender or "").lower()
    for frag, fn in _PARSERS.items():
        if frag in low:
            return fn(snippet, internal_date_ms)
    return []
