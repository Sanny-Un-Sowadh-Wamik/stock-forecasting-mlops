"""Feature-engineering tests (hermetic — synthetic data, no network)."""

import numpy as np
import pandas as pd

from stockfc.config import load_config
from stockfc.features import add_technical_features, build_feature_matrix, feature_columns


def _synthetic(n: int = 300) -> pd.DataFrame:
    idx = pd.bdate_range("2020-01-01", periods=n)
    rng = np.random.default_rng(0)
    close = 50 * np.exp(np.cumsum(rng.normal(0, 0.01, n)))
    df = pd.DataFrame(
        {
            "open": close,
            "high": close * 1.01,
            "low": close * 0.99,
            "close": close,
            "adj_close": close,
            "volume": rng.integers(1_000_000, 5_000_000, n),
        },
        index=idx,
    )
    df.index.name = "date"
    return df


def test_rsi_within_bounds():
    cfg = load_config().features
    out = add_technical_features(_synthetic(), cfg)
    rsi = out[f"rsi_{cfg.rsi_period}"].dropna()
    assert ((rsi >= 0) & (rsi <= 100)).all()


def test_feature_matrix_clean_and_has_target():
    cfg = load_config().features
    fm = build_feature_matrix(_synthetic(), cfg)
    assert not fm.isna().any().any()
    assert "target" in fm.columns
    assert len(feature_columns(fm)) > 5


def test_target_has_no_lookahead():
    """target[t] must be exactly log(close[t+h] / close[t]) — no leakage, no shift error."""
    cfg = load_config().features
    df = _synthetic()
    fm = build_feature_matrix(df, cfg, dropna=False)
    expected = np.log(df["close"].shift(-cfg.target_horizon) / df["close"])
    pd.testing.assert_series_equal(fm["target"], expected, check_names=False)
