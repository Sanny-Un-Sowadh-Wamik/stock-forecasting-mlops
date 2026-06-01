"""Streamlit dashboard for the ASX forecaster.

Self-contained: loads the committed model directly (no running API required), so it
deploys cleanly to Streamlit Community Cloud. Falls back gracefully if the model
artifacts are missing.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `stockfc` importable on Streamlit Cloud without an editable install.
_SRC = Path(__file__).resolve().parent.parent / "src"
if _SRC.exists() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from stockfc.config import load_config
from stockfc.data import load_prices
from stockfc.features import build_feature_matrix
from stockfc.predict import forecast, load_artifacts

st.set_page_config(page_title="ASX Stock Forecaster", page_icon="📈", layout="wide")

CFG = load_config()


def _get_api_url() -> str:
    """Optional link to the live API — from env or Streamlit secrets, never crashing."""
    if os.getenv("API_URL"):
        return os.environ["API_URL"]
    try:
        return st.secrets.get("API_URL", "")  # raises if no secrets file exists
    except Exception:
        return ""


API_URL = _get_api_url()


@st.cache_resource(show_spinner=False)
def _artifacts():
    return load_artifacts()


@st.cache_data(show_spinner=False)
def _history(ticker: str, lookback: int) -> pd.DataFrame:
    return load_prices(ticker, CFG).sort_index().tail(lookback)


# ── Header ───────────────────────────────────────────────────────────────────
st.title("📈 ASX Stock-Price Forecaster")
st.caption(
    "Walk-forward-validated XGBoost forecaster across 10 ASX large-caps · "
    "MLOps lifecycle: ingestion → features → tracking → serving. "
    "**Educational only — not financial advice.**"
)

try:
    model, meta = _artifacts()
except Exception:
    st.error("Model artifacts not found. Run `python scripts/train.py` to train and save the model, then reload.")
    st.stop()

tickers = meta.get("tickers", CFG.data.tickers)
cols = meta["feature_columns"]
cutoff = pd.Timestamp(meta.get("cutoff_date", "2024-12-10"))

with st.sidebar:
    st.header("Controls")
    ticker = st.selectbox("Ticker", tickers, index=0)
    horizon = st.slider("Forecast horizon (trading days)", 1, 30, 5)
    lookback = st.slider("History to display (days)", 60, 500, 180, step=20)
    if API_URL:
        st.markdown(f"🔗 [Live API docs]({API_URL}/docs)")
    st.markdown("---")
    st.caption(f"Model: **{meta.get('serving_model', 'xgboost')}** · trained {meta.get('trained_at', '')[:10]}")

tab_fc, tab_cmp, tab_bt = st.tabs(["📈 Forecast", "🧪 Model comparison", "💹 Backtest"])

# ── Forecast tab ─────────────────────────────────────────────────────────────
with tab_fc:
    hist = _history(ticker, lookback)
    result = forecast(ticker, horizon, CFG)
    fdates = pd.to_datetime([p["date"] for p in result["forecast"]])
    fclose = [p["predicted_close"] for p in result["forecast"]]
    cum_ret = (fclose[-1] / result["last_close"] - 1) * 100 if fclose else 0.0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Last close", f"${result['last_close']:.2f}", help=f"as of {result['last_date']}")
    c2.metric(f"Forecast (+{horizon}d)", f"${fclose[-1]:.2f}" if fclose else "—", delta=f"{cum_ret:+.2f}%")
    c3.metric("Next-day return", f"{result['forecast'][0]['predicted_return'] * 100:+.2f}%" if fclose else "—")
    c4.metric("Direction", "▲ Up" if cum_ret >= 0 else "▼ Down")

    fig = go.Figure()
    fig.add_trace(
        go.Candlestick(
            x=hist.index,
            open=hist["open"],
            high=hist["high"],
            low=hist["low"],
            close=hist["close"],
            name=ticker,
            increasing_line_color="#26a69a",
            decreasing_line_color="#ef5350",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=[hist.index[-1], *fdates],
            y=[result["last_close"], *fclose],
            mode="lines+markers",
            name="Forecast",
            line=dict(color="#1f77b4", width=2, dash="dash"),
        )
    )
    fig.update_layout(
        height=520,
        xaxis_rangeslider_visible=False,
        margin=dict(l=10, r=10, t=30, b=10),
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    st.plotly_chart(fig, width="stretch")

# ── Model comparison tab ─────────────────────────────────────────────────────
with tab_cmp:
    st.subheader("Held-out walk-forward performance")
    st.caption(f"Test period: {cutoff.date()} → present · pooled across all {len(tickers)} tickers")
    metrics = meta.get("metrics", {})
    if metrics:
        table = pd.DataFrame(metrics).T
        table = table.rename(
            columns={
                "price_rmse": "Price RMSE",
                "price_mae": "Price MAE",
                "price_mape": "Price MAPE %",
                "return_rmse": "Return RMSE",
                "directional_accuracy": "Directional acc.",
            }
        )
        table["Directional acc."] = (table["Directional acc."] * 100).round(2)
        st.dataframe(
            table.style.format(
                {
                    "Price RMSE": "{:.4f}",
                    "Price MAE": "{:.4f}",
                    "Price MAPE %": "{:.3f}",
                    "Return RMSE": "{:.6f}",
                    "Directional acc.": "{:.2f}",
                }
            ).highlight_max(subset=["Directional acc."], color="#c8e6c9"),
            width="stretch",
        )
        bar = go.Figure(
            go.Bar(
                x=list(metrics.keys()),
                y=[metrics[m]["directional_accuracy"] * 100 for m in metrics],
                marker_color="#1f77b4",
            )
        )
        bar.add_hline(y=50, line_dash="dot", annotation_text="coin-flip (50%)")
        bar.update_layout(height=340, title="Directional accuracy (%)", margin=dict(t=40, b=10))
        st.plotly_chart(bar, width="stretch")
        st.info(
            "On daily **price RMSE** the random walk is hard to beat — that is the correct, "
            "leakage-free result. The edge shows in **directional accuracy**, where the tuned "
            "XGBoost clears 50% and beats the ARIMA benchmark."
        )

# ── Backtest tab ─────────────────────────────────────────────────────────────
with tab_bt:
    st.subheader("Out-of-sample strategy backtest")
    st.caption(
        "Naïve rule: hold the stock when the model predicts a positive next-day return, "
        "otherwise stay in cash. Out-of-sample only (after the training cutoff). "
        "Ignores transaction costs & slippage — **illustrative, not financial advice.**"
    )
    feats = build_feature_matrix(load_prices(ticker, CFG).sort_index(), CFG.features)
    feats = feats[feats.index >= cutoff]
    if len(feats) < 20:
        st.warning("Not enough out-of-sample data for a backtest.")
    else:
        preds = model.predict(feats[cols])
        signal = (preds > 0).astype(int)
        strat = signal * feats["target"].to_numpy()
        bh = feats["target"].to_numpy()
        cum_strat = np.exp(np.cumsum(strat))
        cum_bh = np.exp(np.cumsum(bh))

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Strategy return", f"{(cum_strat[-1] - 1) * 100:+.1f}%")
        k2.metric("Buy & hold", f"{(cum_bh[-1] - 1) * 100:+.1f}%")
        k3.metric("Hit rate", f"{np.mean(np.sign(preds) == np.sign(bh)) * 100:.1f}%")
        sharpe = np.mean(strat) / (np.std(strat) + 1e-9) * np.sqrt(252)
        k4.metric("Strategy Sharpe", f"{sharpe:.2f}")

        bt = go.Figure()
        bt.add_trace(go.Scatter(x=feats.index, y=cum_strat, name="Model strategy", line=dict(color="#1f77b4")))
        bt.add_trace(go.Scatter(x=feats.index, y=cum_bh, name="Buy & hold", line=dict(color="#888", dash="dash")))
        bt.update_layout(
            height=420,
            title=f"Growth of $1 — {ticker}",
            margin=dict(t=40, b=10),
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
        )
        st.plotly_chart(bt, width="stretch")
