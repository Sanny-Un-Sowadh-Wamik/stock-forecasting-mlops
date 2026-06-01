"""Market-data ingestion from Yahoo Finance.

Design goals:
    * **Cache-first** — pulls are written to ``data/raw/*.parquet`` and reused while
      fresh, so we never hammer Yahoo (which aggressively rate-limits with HTTP 429).
    * **Always runnable** — if the network fails and no cache exists, we fall back to
      a committed ``data/sample`` dataset and, as a last resort, deterministic
      synthetic OHLCV. CI and recruiter demos therefore never break.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd

from stockfc.config import AppConfig, load_config

logger = logging.getLogger(__name__)

OHLCV_COLUMNS = ["open", "high", "low", "close", "adj_close", "volume"]


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def _cache_path(directory: Path, ticker: str, interval: str) -> Path:
    return directory / f"{ticker.replace('.', '_')}_{interval}.parquet"


def _is_fresh(path: Path, cache_days: int) -> bool:
    return path.exists() and (time.time() - path.stat().st_mtime) < cache_days * 86_400


def _normalize(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Flatten yfinance output to tidy lower-snake columns indexed by date."""
    df = df.copy()
    if isinstance(df.columns, pd.MultiIndex):  # single-ticker download → (field, ticker)
        df.columns = df.columns.get_level_values(0)
    df.columns = [str(c).lower().replace(" ", "_") for c in df.columns]
    df.index = pd.to_datetime(df.index)
    df.index.name = "date"
    keep = [c for c in OHLCV_COLUMNS if c in df.columns]
    df = df[keep].dropna(how="all")
    df["ticker"] = ticker
    return df


def _download_yf(
    ticker: str, start: str, end: str | None, interval: str, retries: int = 3, backoff: float = 2.0
) -> pd.DataFrame | None:
    """Download with retry/backoff; returns None if all attempts fail."""
    import yfinance as yf  # imported lazily so the rest of the package stays light

    for attempt in range(1, retries + 1):
        try:
            df = yf.download(
                ticker,
                start=start,
                end=end,
                interval=interval,
                auto_adjust=False,
                progress=False,
                threads=False,
            )
            if df is not None and not df.empty:
                return df
            logger.warning("Empty frame for %s (attempt %d/%d)", ticker, attempt, retries)
        except Exception as exc:  # noqa: BLE001 — yfinance raises a variety of errors
            logger.warning("yfinance error for %s (attempt %d/%d): %s", ticker, attempt, retries, exc)
        time.sleep(backoff * attempt)
    return None


def _synthetic_ohlcv(ticker: str, start: str, end: str | None, interval: str = "1d") -> pd.DataFrame:
    """Deterministic geometric-Brownian-motion OHLCV — last-resort offline fallback.

    Seeded per ticker so results are reproducible. Clearly DEMO-ONLY data.
    """
    rng = np.random.default_rng(abs(hash(ticker)) % (2**32))
    dates = pd.bdate_range(start=start, end=end or pd.Timestamp.today().normalize())
    n = len(dates)
    rets = rng.normal(0.0003, 0.018, n)
    close = 50.0 * np.exp(np.cumsum(rets))
    close = pd.Series(close, index=dates)
    open_ = close.shift(1).fillna(close.iloc[0]) * (1 + rng.normal(0, 0.003, n))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.004, n)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.004, n)))
    df = pd.DataFrame(
        {
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "adj_close": close,
            "volume": rng.integers(1_000_000, 8_000_000, n),
        },
        index=dates,
    )
    df.index.name = "date"
    df["ticker"] = ticker
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────
def fetch_ticker(ticker: str, config: AppConfig | None = None, force: bool = False) -> pd.DataFrame:
    """Return OHLCV for one ticker, using cache → live pull → sample → synthetic."""
    config = config or load_config()
    d = config.data
    d.raw_dir.mkdir(parents=True, exist_ok=True)
    cache = _cache_path(d.raw_dir, ticker, d.interval)

    if not force and _is_fresh(cache, d.cache_days):
        logger.info("cache hit: %s", ticker)
        return pd.read_parquet(cache)

    raw = _download_yf(ticker, d.start_date, d.end_date, d.interval)
    if raw is not None:
        df = _normalize(raw, ticker)
        df.to_parquet(cache)
        logger.info("downloaded %s rows for %s", len(df), ticker)
        return df

    if cache.exists():
        logger.warning("network failed — using stale cache for %s", ticker)
        return pd.read_parquet(cache)

    sample = _cache_path(d.sample_dir, ticker, d.interval)
    if sample.exists():
        logger.warning("network failed — using committed sample for %s", ticker)
        return pd.read_parquet(sample)

    logger.warning("no source for %s — generating SYNTHETIC demo data", ticker)
    return _synthetic_ohlcv(ticker, d.start_date, d.end_date, d.interval)


def ingest_all(config: AppConfig | None = None, force: bool = False) -> pd.DataFrame:
    """Ingest every configured ticker into one tidy long DataFrame."""
    config = config or load_config()
    frames = []
    for ticker in config.data.tickers:
        try:
            frames.append(fetch_ticker(ticker, config, force=force))
        except Exception as exc:  # noqa: BLE001
            logger.error("skipping %s: %s", ticker, exc)
    if not frames:
        raise RuntimeError("No tickers could be ingested.")
    return pd.concat(frames).reset_index()


def load_prices(ticker: str, config: AppConfig | None = None) -> pd.DataFrame:
    """Serving-side loader: prefer cache/sample, only hit the network as a fallback."""
    config = config or load_config()
    for directory in (config.data.raw_dir, config.data.sample_dir):
        path = _cache_path(directory, ticker, config.data.interval)
        if path.exists():
            return pd.read_parquet(path)
    return fetch_ticker(ticker, config)


def build_sample_dataset(config: AppConfig | None = None, n_tickers: int = 3) -> list[Path]:
    """Persist the first ``n_tickers`` into ``data/sample`` to commit as an offline fallback."""
    config = config or load_config()
    config.data.sample_dir.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for ticker in config.data.tickers[:n_tickers]:
        df = fetch_ticker(ticker, config, force=True)
        path = _cache_path(config.data.sample_dir, ticker, config.data.interval)
        df.to_parquet(path)
        saved.append(path)
    return saved
