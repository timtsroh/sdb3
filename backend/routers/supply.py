from __future__ import annotations

import math
import re
from datetime import datetime

import httpx
from fastapi import APIRouter

from cache_utils import get_or_set

router = APIRouter()
TTL_SECONDS = 3600

NAVER_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://finance.naver.com/",
}

INDEX_URLS = {
    "KOSPI": "https://finance.naver.com/sise/sise_index_day.naver?code=KOSPI&page={page}",
    "KOSDAQ": "https://finance.naver.com/sise/sise_index_day.naver?code=KOSDAQ&page={page}",
}

PERIOD_DAYS = {
    "1m": 35,
    "3m": 100,
    "1y": 380,
}


def _fetch_text(url: str) -> str:
    response = httpx.get(url, headers=NAVER_HEADERS, timeout=20.0)
    response.raise_for_status()
    response.encoding = "euc-kr"
    return response.text


def _parse_number(raw: str) -> float:
    normalized = raw.replace(",", "").replace("%", "").replace("+", "").strip()
    return float(normalized)


def _parse_index_history(market: str, period: str) -> list[dict]:
    row_pattern = re.compile(
        r'<td class="date">(?P<date>\d{4}\.\d{2}\.\d{2})</td>\s*'
        r'<td class="number_1">(?P<close>[\d,\.]+)</td>.*?'
        r'<td class="number_1" style="padding-right:40px;">(?P<volume>[\d,]+)</td>\s*'
        r'<td class="number_1" style="padding-right:30px;">(?P<amount>[\d,]+)</td>',
        re.S,
    )

    page_count = max(2, math.ceil(PERIOD_DAYS.get(period, PERIOD_DAYS["3m"]) / 10))
    rows: dict[str, dict] = {}

    for page in range(1, page_count + 1):
        html = _fetch_text(INDEX_URLS[market].format(page=page))
        for match in row_pattern.finditer(html):
            date = datetime.strptime(match.group("date"), "%Y.%m.%d").strftime("%Y-%m-%d")
            rows[date] = {
                "date": date,
                "close": _parse_number(match.group("close")),
                "volume": _parse_number(match.group("volume")),
                "amount": _parse_number(match.group("amount")),
            }

    return sorted(rows.values(), key=lambda item: item["date"])


def _parse_deposit_history(period: str) -> list[dict]:
    row_pattern = re.compile(
        r'<td class="date">(?P<date>\d{2}\.\d{2}\.\d{2})</td>\s*'
        r'<td class="rate_(?:up|down)">(?P<deposit>[\d,]+)</td>',
        re.S,
    )

    page_count = max(2, math.ceil(PERIOD_DAYS.get(period, PERIOD_DAYS["3m"]) / 10))
    rows: dict[str, dict] = {}

    for page in range(1, page_count + 1):
        html = _fetch_text(f"https://finance.naver.com/sise/sise_deposit.naver?page={page}")
        for match in row_pattern.finditer(html):
            date = datetime.strptime(match.group("date"), "%y.%m.%d").strftime("%Y-%m-%d")
            rows[date] = {
                "date": date,
                "deposit_total": _parse_number(match.group("deposit")),
            }

    return sorted(rows.values(), key=lambda item: item["date"])


@router.get("/amounts")
def get_supply_amounts(period: str = "3m"):
    def fetch_amounts():
        kospi_rows = _parse_index_history("KOSPI", period)
        kosdaq_rows = _parse_index_history("KOSDAQ", period)

        merged: dict[str, dict] = {}
        for item in kospi_rows:
            merged.setdefault(item["date"], {"date": item["date"]})
            merged[item["date"]]["kospi_amount"] = item["amount"]
            merged[item["date"]]["kospi_volume"] = item["volume"]
        for item in kosdaq_rows:
            merged.setdefault(item["date"], {"date": item["date"]})
            merged[item["date"]]["kosdaq_amount"] = item["amount"]
            merged[item["date"]]["kosdaq_volume"] = item["volume"]

        return {
            "data": sorted(merged.values(), key=lambda item: item["date"]),
            "source": "Naver Finance 일별지수 시세",
        }

    return get_or_set(
        key=f"supply:amounts:{period}",
        ttl_seconds=TTL_SECONDS,
        fetcher=fetch_amounts,
        fallback={"data": [], "source": "Naver Finance 일별지수 시세"},
    )


@router.get("/deposits")
def get_supply_deposits(period: str = "3m"):
    def fetch_deposits():
        deposit_rows = _parse_deposit_history(period)
        amount_rows = get_supply_amounts(period)["data"]
        amount_by_date = {item["date"]: item for item in amount_rows}

        data = []
        for item in deposit_rows:
            amount_item = amount_by_date.get(item["date"])
            if not amount_item:
                continue

            kospi_amount = float(amount_item.get("kospi_amount", 0) or 0)
            kosdaq_amount = float(amount_item.get("kosdaq_amount", 0) or 0)
            total_amount = kospi_amount + kosdaq_amount
            if total_amount <= 0:
                continue

            deposit_total = float(item["deposit_total"])
            kospi_ratio = kospi_amount / total_amount
            kosdaq_ratio = kosdaq_amount / total_amount

            data.append(
                {
                    "date": item["date"],
                    "deposit_total": deposit_total,
                    "kospi_deposit": round(deposit_total * kospi_ratio, 2),
                    "kosdaq_deposit": round(deposit_total * kosdaq_ratio, 2),
                }
            )

        return {
            "data": data,
            "source": "Naver Finance 증시자금동향 고객예탁금 + 시장별 거래대금 비중 추정",
        }

    return get_or_set(
        key=f"supply:deposits:{period}",
        ttl_seconds=TTL_SECONDS,
        fetcher=fetch_deposits,
        fallback={"data": [], "source": "Naver Finance 증시자금동향"},
    )
