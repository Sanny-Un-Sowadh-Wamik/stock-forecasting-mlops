"""Ingestion tests (hermetic — exercise the offline fallbacks, no network)."""

import pandas as pd

from stockfc.data.ingest import _normalize, _synthetic_ohlcv


def test_synthetic_ohlcv_is_well_formed():
    df = _synthetic_ohlcv("TEST.AX", "2020-01-01", "2020-06-01")
    assert {"open", "high", "low", "close", "adj_close", "volume", "ticker"} <= set(df.columns)
    assert (df["high"] >= df["low"]).all()
    assert (df["close"] > 0).all()
    assert df["ticker"].eq("TEST.AX").all()


def test_normalize_flattens_multiindex_columns():
    idx = pd.bdate_range("2020-01-01", periods=5)
    raw = pd.DataFrame(
        {("Open", "X"): range(5), ("Close", "X"): range(5), ("Volume", "X"): range(5)},
        index=idx,
    )
    out = _normalize(raw, "X.AX")
    assert "close" in out.columns
    assert out["ticker"].iloc[0] == "X.AX"
    assert out.index.name == "date"
