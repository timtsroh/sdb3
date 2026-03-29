from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from database import get_db, MacroPanel
from cache_utils import get_or_set
import yfinance as yf
import FinanceDataReader as fdr
import pandas as pd

router = APIRouter()
TTL_SECONDS = 3600

PRESET_TICKERS = {
    "US10YT=X": {"label": "미국 10Y 금리", "group": "macro", "source": "FinanceDataReader / Yahoo Finance"},
    "SP500":    {"label": "S&P 500", "group": "market", "source": "FinanceDataReader / Yahoo Finance"},
    "DX-Y.NYB": {"label": "달러 인덱스", "group": "macro", "source": "Yahoo Finance"},
    "CL=F":     {"label": "WTI 유가", "group": "macro", "source": "Yahoo Finance"},
    "VIX":      {"label": "VIX 지수", "group": "macro", "source": "FinanceDataReader / Yahoo Finance"},
    "QQQ":      {"label": "나스닥 100", "group": "market", "source": "Yahoo Finance"},
    "KS11":     {"label": "KOSPI", "group": "market", "source": "FinanceDataReader / Yahoo Finance"},
    "KQ11":     {"label": "KOSDAQ", "group": "market", "source": "FinanceDataReader / Yahoo Finance"},
    "GC=F":     {"label": "금 선물", "group": "macro", "source": "Yahoo Finance"},
    "IXIC":     {"label": "나스닥 종합", "group": "market", "source": "FinanceDataReader / Yahoo Finance"},
    "DJI":      {"label": "다우존스", "group": "market", "source": "FinanceDataReader / Yahoo Finance"},
}
LEGACY_TICKER_MAP = {
    "^TNX": "US10YT=X",
    "^GSPC": "SP500",
    "^VIX": "VIX",
    "^NDX": "QQQ",
    "^KS11": "KS11",
    "^KQ11": "KQ11",
    "^IXIC": "IXIC",
    "^DJI": "DJI",
}


class UpdatePanelRequest(BaseModel):
    ticker: str
    label:  str
    group:  str = "macro"


@router.get("/panels")
def get_panels(group: str = Query(default="macro"), db: Session = Depends(get_db)):
    panels = db.query(MacroPanel).filter(MacroPanel.panel_group == group).order_by(MacroPanel.slot).all()
    return [
        {
            "slot": p.slot,
            "ticker": p.ticker,
            "label": p.label,
            "group": p.panel_group,
            "source": PRESET_TICKERS.get(p.ticker, {}).get("source", "FinanceDataReader / Yahoo Finance"),
        }
        for p in panels
    ]


class ReorderRequest(BaseModel):
    slots: List[int]
    group: str = "macro"


@router.put("/panels/reorder")
def reorder_panels(req: ReorderRequest, db: Session = Depends(get_db)):
    panels = db.query(MacroPanel).filter(MacroPanel.panel_group == req.group).order_by(MacroPanel.slot).all()
    panel_data = [(p.ticker, p.label) for p in panels]
    slot_to_data = {panels[i].slot: panel_data[i] for i in range(len(panels))}

    ordered_data = []
    for s in req.slots:
        if s in slot_to_data:
            ordered_data.append(slot_to_data[s])

    for i, panel in enumerate(panels):
        if i < len(ordered_data):
            panel.ticker = ordered_data[i][0]
            panel.label = ordered_data[i][1]
    db.commit()
    return {"ok": True}


@router.put("/panels/{slot}")
def update_panel(slot: int, req: UpdatePanelRequest, db: Session = Depends(get_db)):
    panel = db.query(MacroPanel).filter(MacroPanel.slot == slot, MacroPanel.panel_group == req.group).first()
    if panel:
        panel.ticker = req.ticker
        panel.label  = req.label
        db.commit()
    return {"ok": True}


@router.get("/presets")
def get_presets(group: str = Query(default="macro")):
    return [
        {"ticker": ticker, "label": meta["label"], "group": meta["group"], "source": meta["source"]}
        for ticker, meta in PRESET_TICKERS.items()
        if meta["group"] == group
    ]


@router.get("/chart/{ticker}")
def get_macro_chart(ticker: str, period: str = "5y"):
    normalized_ticker = LEGACY_TICKER_MAP.get(ticker, ticker)
    source = PRESET_TICKERS.get(normalized_ticker, {}).get("source", "FinanceDataReader / Yahoo Finance")

    def fetch_chart():
        days = {"1y": 365, "3y": 365 * 3, "5y": 365 * 5}.get(period, 365 * 5)
        start = (pd.Timestamp.today() - pd.Timedelta(days=days)).strftime("%Y-%m-%d")

        try:
            df = fdr.DataReader(normalized_ticker, start)
        except Exception:
            yf_ticker = {
                "SP500": "^GSPC",
                "VIX": "^VIX",
                "QQQ": "QQQ",
                "KS11": "^KS11",
                "KQ11": "^KQ11",
                "IXIC": "^IXIC",
                "DJI": "^DJI",
                "US10YT=X": "^TNX",
            }.get(normalized_ticker, normalized_ticker)
            df = yf.download(yf_ticker, period=period, auto_adjust=True, progress=False)

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)

        if df.empty:
            return {"data": [], "latest": None, "change": None, "period_change": None}

        chart_df = df[["Close"]].dropna().reset_index()
        chart_df.columns = ["date", "close"]

        latest = float(chart_df["close"].iloc[-1])
        prev = float(chart_df["close"].iloc[-2]) if len(chart_df) > 1 else latest
        first = float(chart_df["close"].iloc[0])

        change = round((latest - prev) / prev * 100, 2) if prev != 0 else 0
        period_change = round((latest - first) / first * 100, 2) if first != 0 else 0

        if len(chart_df) > 180:
            original_last_row = chart_df.iloc[[-1]].copy()
            sample_step = max(1, len(chart_df) // 90)
            chart_df = chart_df.iloc[::sample_step].reset_index(drop=True)
            if str(chart_df["date"].iloc[-1]) != str(original_last_row["date"].iloc[0]):
                chart_df = pd.concat([chart_df, original_last_row], ignore_index=True)

        chart_df["date"] = chart_df["date"].astype(str)
        return {
            "data": chart_df.to_dict(orient="records"),
            "latest": round(latest, 4),
            "change": change,
            "period_change": period_change,
            "source": source,
        }

    return get_or_set(
        key=f"macro:chart:{normalized_ticker}:{period}",
        ttl_seconds=TTL_SECONDS,
        fetcher=fetch_chart,
        fallback={"data": [], "latest": None, "change": None, "period_change": None, "source": source},
    )
