"""Baselines: naïve persistence (random walk) and per-ticker rolling ARIMA.

Both are evaluated on exactly the same held-out rows as the ML models, so the
comparison is apples-to-apples.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from stockfc.models.evaluate import evaluate_return_model

logger = logging.getLogger(__name__)


def persistence_metrics(test_df: pd.DataFrame) -> dict[str, float]:
    """Random-walk baseline: tomorrow's price == today's price (log-return 0)."""
    return evaluate_return_model(test_df, np.zeros(len(test_df)))


def arima_evaluate(
    feature_df: pd.DataFrame,
    cutoff: pd.Timestamp,
    order: tuple[int, int, int] = (5, 1, 0),
    max_tickers: int | None = None,
) -> tuple[dict[str, float], pd.DataFrame, np.ndarray]:
    """Per-ticker ARIMA with efficient one-step rolling forecasts (refit=False).

    For each test day t we condition the model through ``close_t`` and forecast
    ``close_{t+1}`` — the same one-step-ahead target the ML models predict.
    """
    from statsmodels.tsa.arima.model import ARIMA

    tickers = feature_df["ticker"].unique()
    if max_tickers:
        tickers = tickers[:max_tickers]

    test_parts: list[pd.DataFrame] = []
    pred_parts: list[np.ndarray] = []

    for ticker in tickers:
        g = feature_df[feature_df["ticker"] == ticker].sort_values("date")
        train = g[g["date"] < cutoff]
        test = g[g["date"] >= cutoff]
        if len(train) < 60 or len(test) == 0:
            continue
        try:
            res = ARIMA(train["close"].to_numpy(), order=order).fit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("ARIMA fit failed for %s: %s", ticker, exc)
            continue

        today_close = test["close"].to_numpy()
        preds = np.empty(len(test))
        for i in range(len(test)):
            res = res.append([today_close[i]], refit=False)  # condition through close_t
            preds[i] = res.forecast(steps=1)[0]  # predict close_{t+1}

        pred_ret = np.log(preds / today_close)
        test_parts.append(test)
        pred_parts.append(pred_ret)

    if not test_parts:
        raise RuntimeError("ARIMA produced no predictions.")

    test_all = pd.concat(test_parts, ignore_index=True)
    pred_all = np.concatenate(pred_parts)
    return evaluate_return_model(test_all, pred_all), test_all, pred_all
