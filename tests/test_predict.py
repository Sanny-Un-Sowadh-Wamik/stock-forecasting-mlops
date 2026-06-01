"""Inference tests — skipped automatically if the model hasn't been trained yet."""

import pytest

from stockfc.predict import MODELS_DIR, forecast, model_metadata

pytestmark = pytest.mark.skipif(
    not (MODELS_DIR / "xgb_forecaster.json").exists(),
    reason="model not trained — run scripts/train.py",
)


def test_metadata_is_complete():
    meta = model_metadata()
    assert meta["feature_columns"]
    assert meta["tickers"]
    assert "metrics" in meta


def test_forecast_structure_and_length():
    ticker = model_metadata()["tickers"][0]
    result = forecast(ticker, horizon=3)
    assert result["ticker"] == ticker
    assert len(result["forecast"]) == 3
    assert all("predicted_close" in p and "predicted_return" in p for p in result["forecast"])
    assert result["last_close"] > 0
