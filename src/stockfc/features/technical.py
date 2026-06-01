"""Technical-indicator feature engineering — pure pandas/numpy, no native deps.

TA-Lib is deliberately avoided: it requires a C library that is painful to install
in CI and slim Docker images. Re-implementing the core indicators keeps the build
fully reproducible and shows the underlying maths.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from stockfc.config import FeatureConfig, load_config

# Columns that are inputs/targets, never model features.
_NON_FEATURE = {"open", "high", "low", "close", "adj_close", "volume", "ticker", "target"}


def _rsi(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    # Wilder's smoothing (EWM with alpha = 1/period)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    return 100 - (100 / (1 + rs))


def _macd(close: pd.Series, fast: int, slow: int, signal: int):
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    return macd, macd_signal, macd - macd_signal


def _bollinger(close: pd.Series, window: int, n_std: float):
    ma = close.rolling(window).mean()
    sd = close.rolling(window).std()
    upper, lower = ma + n_std * sd, ma - n_std * sd
    width = (upper - lower) / ma
    pct_b = (close - lower) / (upper - lower)
    return upper, lower, width, pct_b


def add_technical_features(df: pd.DataFrame, config: FeatureConfig | None = None) -> pd.DataFrame:
    """Append technical indicators to a single ticker's OHLCV frame (date-indexed)."""
    cfg = config or load_config().features
    out = df.sort_index().copy()
    close = out["close"]

    out["log_return"] = np.log(close / close.shift(1))
    for w in cfg.sma_windows:
        out[f"sma_{w}"] = close.rolling(w).mean()
        out[f"close_sma_{w}_ratio"] = close / out[f"sma_{w}"]
    for w in cfg.ema_windows:
        out[f"ema_{w}"] = close.ewm(span=w, adjust=False).mean()

    out[f"rsi_{cfg.rsi_period}"] = _rsi(close, cfg.rsi_period)

    macd, macd_signal, macd_hist = _macd(close, cfg.macd_fast, cfg.macd_slow, cfg.macd_signal)
    out["macd"], out["macd_signal"], out["macd_hist"] = macd, macd_signal, macd_hist

    upper, lower, width, pct_b = _bollinger(close, cfg.bb_window, cfg.bb_std)
    out["bb_upper"], out["bb_lower"], out["bb_width"], out["bb_pctb"] = upper, lower, width, pct_b

    out["volatility_21"] = out["log_return"].rolling(21).std()
    out["volume_sma_ratio"] = out["volume"] / out["volume"].rolling(20).mean()
    for lag in cfg.return_lags:
        out[f"ret_lag_{lag}"] = out["log_return"].shift(lag)

    return out


def make_target(df: pd.DataFrame, config: FeatureConfig | None = None) -> pd.DataFrame:
    """Add the supervised target: the h-day-ahead log-return (or raw price)."""
    cfg = config or load_config().features
    out = df.copy()
    h = cfg.target_horizon
    if cfg.target_kind == "log_return":
        out["target"] = np.log(out["close"].shift(-h) / out["close"])
    else:
        out["target"] = out["close"].shift(-h)
    return out


def feature_columns(df: pd.DataFrame) -> list[str]:
    """Engineered numeric columns to feed a model (excludes raw OHLCV + target)."""
    return [c for c in df.columns if c not in _NON_FEATURE and pd.api.types.is_numeric_dtype(df[c])]


def build_feature_matrix(df: pd.DataFrame, config: FeatureConfig | None = None, dropna: bool = True) -> pd.DataFrame:
    """Full single-ticker pipeline: indicators + target, NaNs dropped by default."""
    cfg = config or load_config().features
    out = add_technical_features(df, cfg)
    out = make_target(out, cfg)
    return out.dropna() if dropna else out
