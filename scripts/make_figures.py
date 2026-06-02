"""Generate the README results figure from the trained model + metadata.

Run:  python scripts/make_figures.py   (writes docs/images/results.png)
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from stockfc.config import REPO_ROOT  # noqa: E402

META = json.loads((REPO_ROOT / "models" / "metadata.json").read_text())
OUT = REPO_ROOT / "docs" / "images"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    metrics = META["metrics"]
    models = list(metrics.keys())
    diracc = [metrics[k]["directional_accuracy"] * 100 for k in models]
    colours = ["#1f77b4" if k == "xgboost" else "#b0bec5" for k in models]

    fig, ax = plt.subplots(1, 2, figsize=(13, 4.4))

    ax[0].bar(models, diracc, color=colours)
    ax[0].axhline(50, ls="--", c="#e53935", lw=1.2, label="coin-flip (50%)")
    ax[0].set_title("Directional accuracy — walk-forward (higher = better)")
    ax[0].set_ylabel("%")
    ax[0].set_ylim(0, 60)
    ax[0].legend(fontsize=8)
    for i, v in enumerate(diracc):
        ax[0].text(i, v + 1, f"{v:.1f}", ha="center", fontsize=9)
    ax[0].tick_params(axis="x", rotation=15)

    try:  # forecast panel (needs the model + cached data)
        from stockfc.predict import forecast, get_history

        ticker = META["tickers"][0]
        res = forecast(ticker, 10)
        hist = get_history(ticker, lookback=90)
        fdates = [np.datetime64(p["date"]) for p in res["forecast"]]
        fclose = [p["predicted_close"] for p in res["forecast"]]
        ax[1].plot(hist.index, hist["close"], c="#37474f", lw=1.3, label="history")
        ax[1].plot([hist.index[-1], *fdates], [res["last_close"], *fclose], "--o",
                   c="#1f77b4", ms=3, label="10-day forecast")
        ax[1].set_title(f"{ticker} — recursive forecast")
        ax[1].legend(fontsize=8)
        ax[1].tick_params(axis="x", rotation=20)
    except Exception as exc:  # noqa: BLE001 — fall back to a price-RMSE bar
        rmse = [metrics[k]["price_rmse"] for k in models]
        ax[1].bar(models, rmse, color=colours)
        ax[1].set_title(f"Price RMSE (lower = better) [{exc.__class__.__name__}]")
        ax[1].tick_params(axis="x", rotation=15)

    fig.suptitle("ASX Forecasting — held-out results (test: 2024-12 → present)", fontsize=12, weight="bold")
    plt.tight_layout()
    plt.savefig(OUT / "results.png", dpi=130, bbox_inches="tight")
    print("saved", OUT / "results.png")


if __name__ == "__main__":
    main()
