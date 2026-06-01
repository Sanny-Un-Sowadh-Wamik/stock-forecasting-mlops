"""Inference: load the registered XGBoost model and forecast a ticker.

Forecasts are recursive one-step-ahead: predict tomorrow's log-return, roll the
predicted bar into the series so the indicators advance, and repeat ``horizon``
times. Used by both the FastAPI service and the Streamlit dashboard.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from stockfc.config import REPO_ROOT, AppConfig, load_config
from stockfc.data import load_prices
from stockfc.features import add_technical_features

MODELS_DIR = Path(os.getenv("STOCKFC_MODELS_DIR", str(REPO_ROOT / "models")))
_BDAY = pd.tseries.offsets.BusinessDay()


@lru_cache(maxsize=1)
def load_artifacts() -> tuple[xgb.XGBRegressor, dict]:
    """Load the serving model + metadata once and cache them."""
    meta = json.loads((MODELS_DIR / "metadata.json").read_text())
    model = xgb.XGBRegressor()
    model.load_model(str(MODELS_DIR / "xgb_forecaster.json"))
    return model, meta


def model_metadata() -> dict:
    return load_artifacts()[1]


def get_history(ticker: str, config: AppConfig | None = None, lookback: int = 180) -> pd.DataFrame:
    config = config or load_config()
    return load_prices(ticker, config).sort_index().tail(lookback)


def forecast(ticker: str, horizon: int = 1, config: AppConfig | None = None) -> dict:
    """Recursive multi-step forecast for one ticker."""
    config = config or load_config()
    model, meta = load_artifacts()
    cols = meta["feature_columns"]

    work = load_prices(ticker, config).sort_index()
    if work.empty:
        raise ValueError(f"No price data available for {ticker}")

    last_close = float(work["close"].iloc[-1])
    last_date = pd.Timestamp(work.index[-1])

    preds: list[dict] = []
    cur_close, cur_date = last_close, last_date
    for _ in range(horizon):
        feats = add_technical_features(work, config.features).dropna()
        if feats.empty:
            break
        log_ret = float(model.predict(feats[cols].iloc[[-1]])[0])
        cur_close *= float(np.exp(log_ret))
        cur_date += _BDAY
        preds.append(
            {
                "date": cur_date.strftime("%Y-%m-%d"),
                "predicted_close": round(cur_close, 4),
                "predicted_return": round(log_ret, 6),
            }
        )
        # Roll the predicted bar forward so indicators keep advancing.
        work = pd.concat(
            [
                work,
                pd.DataFrame(
                    {
                        "open": cur_close,
                        "high": cur_close,
                        "low": cur_close,
                        "close": cur_close,
                        "adj_close": cur_close,
                        "volume": float(work["volume"].iloc[-1]),
                        "ticker": ticker,
                    },
                    index=[cur_date],
                ),
            ]
        )

    return {
        "ticker": ticker,
        "horizon": horizon,
        "last_date": last_date.strftime("%Y-%m-%d"),
        "last_close": round(last_close, 4),
        "forecast": preds,
        "model": {
            "name": meta.get("serving_model", "xgboost"),
            "registry_name": meta.get("registry_name"),
            "trained_at": meta.get("trained_at"),
        },
    }
