from sqlalchemy import create_engine, Column, String, Boolean, Integer, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

BASE_DIR = os.path.dirname(__file__)
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "stock_dashboard.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class WatchlistItem(Base):
    __tablename__ = "watchlist"
    id       = Column(Integer, primary_key=True, index=True)
    ticker   = Column(String, unique=True, nullable=False)
    name     = Column(String)
    market   = Column(String, default="US")
    added_at = Column(DateTime, default=datetime.utcnow)


class MacroPanel(Base):
    __tablename__ = "macro_panels"
    id          = Column(Integer, primary_key=True, index=True)
    slot        = Column(Integer, unique=True)
    ticker      = Column(String)
    label       = Column(String)
    panel_group = Column(String, default="macro")


class EventFilter(Base):
    __tablename__ = "event_filters"
    id      = Column(Integer, primary_key=True, index=True)
    key     = Column(String, unique=True)
    label   = Column(String)
    enabled = Column(Boolean, default=True)
    color   = Column(String)


def init_db():
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        column_names = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(macro_panels)").fetchall()]
        if "panel_group" not in column_names:
            conn.exec_driver_sql("ALTER TABLE macro_panels ADD COLUMN panel_group VARCHAR DEFAULT 'macro'")

    db = SessionLocal()

    if db.query(WatchlistItem).count() == 0:
        defaults = [
            WatchlistItem(ticker="AAPL",   name="Apple",      market="US"),
            WatchlistItem(ticker="NVDA",   name="NVIDIA",     market="US"),
            WatchlistItem(ticker="005930", name="삼성전자",   market="KR"),
            WatchlistItem(ticker="000660", name="SK하이닉스", market="KR"),
        ]
        db.add_all(defaults)

    market_tickers = {"SP500", "QQQ", "KS11", "KQ11", "IXIC", "DJI"}
    all_default_panels = [
        MacroPanel(slot=0,  ticker="US10YT=X", label="미국 10Y 금리", panel_group="macro"),
        MacroPanel(slot=1,  ticker="SP500",    label="S&P 500", panel_group="market"),
        MacroPanel(slot=2,  ticker="DX-Y.NYB", label="달러 인덱스", panel_group="macro"),
        MacroPanel(slot=3,  ticker="CL=F",     label="WTI 유가", panel_group="macro"),
        MacroPanel(slot=4,  ticker="VIX",      label="VIX 지수", panel_group="macro"),
        MacroPanel(slot=5,  ticker="QQQ",      label="나스닥 100", panel_group="market"),
        MacroPanel(slot=6,  ticker="KS11",     label="KOSPI", panel_group="market"),
        MacroPanel(slot=7,  ticker="KQ11",     label="KOSDAQ", panel_group="market"),
        MacroPanel(slot=8,  ticker="GC=F",     label="금 선물", panel_group="macro"),
        MacroPanel(slot=9,  ticker="IXIC",     label="나스닥 종합", panel_group="market"),
        MacroPanel(slot=10, ticker="DJI",      label="다우존스", panel_group="market"),
    ]
    existing_slots = {p.slot for p in db.query(MacroPanel).all()}
    new_panels = [p for p in all_default_panels if p.slot not in existing_slots]
    if new_panels:
        db.add_all(new_panels)

    for panel in db.query(MacroPanel).all():
        panel.panel_group = "market" if panel.ticker in market_tickers else "macro"

    db.query(MacroPanel).filter(MacroPanel.panel_group == "macro", MacroPanel.ticker == "QQQ").update(
        {MacroPanel.panel_group: "market"},
        synchronize_session=False,
    )

    if db.query(EventFilter).count() == 0:
        filters = [
            EventFilter(key="earnings",     label="Earnings Call",   enabled=True, color="#3b82f6"),
            EventFilter(key="fed",          label="Fed Meeting",     enabled=True, color="#ef4444"),
            EventFilter(key="cpi",          label="CPI 발표",        enabled=True, color="#f97316"),
            EventFilter(key="ppi",          label="PPI 발표",        enabled=True, color="#eab308"),
            EventFilter(key="nfp",          label="고용보고서",       enabled=True, color="#22c55e"),
            EventFilter(key="pce",          label="PCE 발표",        enabled=True, color="#a855f7"),
            EventFilter(key="gdp",          label="GDP 발표",        enabled=True, color="#a16207"),
            EventFilter(key="fomc_minutes", label="FOMC 의사록",     enabled=True, color="#f87171"),
            EventFilter(key="ism",          label="ISM 제조업 PMI",  enabled=True, color="#6b7280"),
            EventFilter(key="consumer",     label="소비자신뢰지수",   enabled=True, color="#38bdf8"),
        ]
        db.add_all(filters)

    db.commit()
    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
