"""FastAPI endpoint tests — skipped automatically if the model hasn't been trained."""

import pytest
from fastapi.testclient import TestClient

from stockfc.predict import MODELS_DIR

pytestmark = pytest.mark.skipif(
    not (MODELS_DIR / "xgb_forecaster.json").exists(),
    reason="model not trained — run scripts/train.py",
)

from api.main import app  # noqa: E402 — import after the skip guard

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_models_returns_metrics():
    resp = client.get("/models")
    assert resp.status_code == 200
    assert "metrics" in resp.json()


def test_predict_returns_horizon():
    ticker = client.get("/tickers").json()["tickers"][0]
    resp = client.get("/predict", params={"ticker": ticker, "horizon": 2})
    assert resp.status_code == 200
    assert len(resp.json()["forecast"]) == 2


def test_predict_rejects_bad_horizon():
    assert client.get("/predict", params={"ticker": "BHP.AX", "horizon": 99}).status_code == 422
