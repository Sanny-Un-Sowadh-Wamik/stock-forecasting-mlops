"""Forecast evaluation: reconstruct price from predicted log-returns and score
on both the price scale (comparable to ARIMA) and the return scale (the metric
that actually matters), plus directional accuracy.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def reconstruct_price(close_today: np.ndarray, pred_log_return: np.ndarray) -> np.ndarray:
    """price_{t+h} = close_t * exp(predicted log-return)."""
    return close_today * np.exp(pred_log_return)


def directional_accuracy(true_ret: np.ndarray, pred_ret: np.ndarray) -> float:
    """Share of days where the predicted direction matches the realised one."""
    return float(np.mean(np.sign(true_ret) == np.sign(pred_ret)))


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    err = y_pred - y_true
    return {
        "price_rmse": float(np.sqrt(np.mean(err**2))),
        "price_mae": float(np.mean(np.abs(err))),
        "price_mape": float(np.mean(np.abs(err / y_true)) * 100),
    }


def evaluate_return_model(test_df: pd.DataFrame, pred_log_return: np.ndarray) -> dict[str, float]:
    """Score a model that predicts the h-day-ahead log-return.

    ``test_df`` must carry ``close`` (price at t) and ``target`` (true log-return).
    """
    close = test_df["close"].to_numpy()
    true_ret = test_df["target"].to_numpy()
    pred_log_return = np.asarray(pred_log_return)

    true_future = reconstruct_price(close, true_ret)
    pred_future = reconstruct_price(close, pred_log_return)

    metrics = regression_metrics(true_future, pred_future)
    metrics["return_rmse"] = float(np.sqrt(np.mean((pred_log_return - true_ret) ** 2)))
    metrics["directional_accuracy"] = directional_accuracy(true_ret, pred_log_return)
    return {k: round(v, 6) for k, v in metrics.items()}
