"""Assemble the pooled, leakage-free modelling dataset.

We pool every ticker into one frame and model **log-returns** (scale-free), so a
single model generalises across stocks. The train/test boundary is a global
**date cutoff** — training only ever sees earlier dates than evaluation.
"""

from __future__ import annotations

import logging

import pandas as pd

from stockfc.config import AppConfig, load_config
from stockfc.data import ingest_all
from stockfc.features import build_feature_matrix, feature_columns

logger = logging.getLogger(__name__)


def build_modeling_frame(config: AppConfig | None = None, force: bool = False, persist: bool = True) -> pd.DataFrame:
    """Ingest all tickers, engineer features per ticker, return one pooled frame."""
    config = config or load_config()
    prices = ingest_all(config, force=force)

    frames = []
    for ticker, group in prices.groupby("ticker"):
        feats = build_feature_matrix(group.set_index("date").sort_index(), config.features)
        feats["ticker"] = ticker
        frames.append(feats.reset_index())

    df = pd.concat(frames, ignore_index=True).sort_values(["date", "ticker"]).reset_index(drop=True)
    if persist:
        config.data.processed_dir.mkdir(parents=True, exist_ok=True)
        out = config.data.processed_dir / "features.parquet"
        df.to_parquet(out)
        logger.info("wrote %d rows → %s", len(df), out)
    return df


def date_holdout_split(df: pd.DataFrame, test_size: float) -> tuple[pd.DataFrame, pd.DataFrame, pd.Timestamp]:
    """Split pooled frame by a global date cutoff (train = strictly earlier dates)."""
    dates = pd.Series(df["date"].unique()).sort_values().to_numpy()
    cutoff = dates[int(len(dates) * (1 - test_size))]
    train = df[df["date"] < cutoff].reset_index(drop=True)
    test = df[df["date"] >= cutoff].reset_index(drop=True)
    return train, test, pd.Timestamp(cutoff)


def xy(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    """Return (features, target, feature_column_names)."""
    cols = feature_columns(df)
    return df[cols], df["target"], cols
