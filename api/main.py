"""FastAPI prediction service for ASX stock forecasts.

Endpoints:
    GET /health   — liveness probe
    GET /models   — registered model metadata + held-out metrics
    GET /tickers  — tickers the model was trained on
    GET /predict  — ?ticker=BHP.AX&horizon=5  → JSON forecast

Interactive docs are auto-generated at /docs (OpenAPI) — the URL to share with recruiters.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from stockfc import __version__
from stockfc.config import load_config
from stockfc.predict import forecast, model_metadata

app = FastAPI(
    title="ASX Stock Forecaster API",
    version=__version__,
    description=(
        "Forecast next-day(s) closing prices for ASX equities with a walk-forward-"
        "validated XGBoost model. Educational project — **not financial advice**."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # public demo API
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/models", tags=["meta"])
def models() -> dict:
    meta = model_metadata()
    keys = (
        "serving_model",
        "registry_name",
        "trained_at",
        "tickers",
        "target_horizon",
        "cutoff_date",
        "metrics",
    )
    return {k: meta[k] for k in keys if k in meta}


@app.get("/tickers", tags=["meta"])
def tickers() -> dict:
    return {"tickers": model_metadata().get("tickers", [])}


@app.get("/predict", tags=["forecast"])
def predict(
    ticker: str = Query(..., examples=["BHP.AX"], description="ASX ticker (Yahoo .AX suffix)"),
    horizon: int = Query(1, ge=1, le=30, description="Trading days ahead to forecast"),
) -> dict:
    try:
        return forecast(ticker.upper(), horizon, load_config())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
