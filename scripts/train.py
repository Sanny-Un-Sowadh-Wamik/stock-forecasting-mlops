"""Train + evaluate the price models, log to MLflow, and persist the best for serving.

Trains the persistence baseline, ARIMA, and a tuned XGBoost (the registered serving
model). The LSTM is trained separately by ``scripts/train_lstm.py`` in its own process
to avoid a TensorFlow/OpenMP deadlock when TF runs after XGBoost in one process.

Usage:
    python scripts/train.py                 # full run (Optuna trials from config)
    python scripts/train.py --trials 10     # quick run
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import UTC, datetime

from stockfc.config import REPO_ROOT, load_config
from stockfc.models import registry
from stockfc.models.baselines import arima_evaluate, persistence_metrics
from stockfc.models.dataset import build_modeling_frame, date_holdout_split, xy
from stockfc.models.evaluate import evaluate_return_model
from stockfc.models.xgb_model import train_xgboost, tune_xgboost

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("train")

MODELS_DIR = REPO_ROOT / "models"


def main(trials: int | None = None, use_arima: bool = True) -> dict:
    cfg = load_config()
    df = build_modeling_frame(cfg)
    train, test, cutoff = date_holdout_split(df, cfg.model.test_size)
    log.info("pooled rows=%d | train=%d test=%d | cutoff=%s", len(df), len(train), len(test), cutoff.date())

    X_train, y_train, cols = xy(train)
    X_test = test[cols]

    results: dict[str, dict] = {}

    # ── Baselines ────────────────────────────────────────────────────────────
    results["persistence"] = persistence_metrics(test)
    log.info("persistence  → %s", results["persistence"])
    if use_arima:
        try:
            results["arima"], _, _ = arima_evaluate(df, cutoff)
            log.info("arima        → %s", results["arima"])
        except Exception as exc:  # noqa: BLE001
            log.warning("ARIMA skipped: %s", exc)

    # ── XGBoost (tuned) — the registered serving model ───────────────────────
    n_trials = trials or cfg.model.optuna_trials
    log.info("tuning XGBoost with %d Optuna trials …", n_trials)
    best_params, best_cv = tune_xgboost(
        X_train, y_train, n_trials=n_trials, n_splits=cfg.model.cv_splits, random_state=cfg.model.random_state
    )
    log.info("best CV return-RMSE=%.6f", best_cv)
    xgb_model = train_xgboost(X_train, y_train, best_params, cfg.model.random_state)
    results["xgboost"] = evaluate_return_model(test, xgb_model.predict(X_test))
    log.info("xgboost      → %s", results["xgboost"])

    _print_table(results)

    # ── MLflow tracking + registry ───────────────────────────────────────────
    try:
        registry.init_mlflow()
        for name in ("persistence", "arima"):
            if name in results:
                registry.log_model_run(name, {}, results[name])
        registry.log_model_run(
            "xgboost",
            best_params,
            results["xgboost"],
            model=xgb_model,
            flavor="xgboost",
            registered_name=cfg.model.registry_name,
        )
        log.info("logged runs to MLflow (%s)", registry.get_settings().mlflow_tracking_uri)
    except Exception as exc:  # noqa: BLE001
        log.warning("MLflow logging skipped: %s", exc)

    # ── Persist serving artifacts (XGBoost is what the API serves) ───────────
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    xgb_model.save_model(str(MODELS_DIR / "xgb_forecaster.json"))
    metadata = {
        "registry_name": cfg.model.registry_name,
        "serving_model": "xgboost",
        "trained_at": datetime.now(UTC).isoformat(),
        "tickers": cfg.data.tickers,
        "target_kind": cfg.features.target_kind,
        "target_horizon": cfg.features.target_horizon,
        "feature_columns": cols,
        "best_params": best_params,
        "cv_return_rmse": best_cv,
        "cutoff_date": str(cutoff.date()),
        "metrics": results,
    }
    (MODELS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))
    log.info("saved model + metadata → %s", MODELS_DIR)
    return results


def _print_table(results: dict[str, dict]) -> None:
    print("\n" + "=" * 78)
    print(f"{'model':<14}{'price_RMSE':>12}{'price_MAPE%':>13}{'return_RMSE':>14}{'dir_acc':>11}")
    print("-" * 78)
    for name, m in results.items():
        print(
            f"{name:<14}{m['price_rmse']:>12.4f}{m['price_mape']:>13.3f}"
            f"{m['return_rmse']:>14.6f}{m['directional_accuracy'] * 100:>10.2f}%"
        )
    print("=" * 78 + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--trials", type=int, default=None, help="Optuna trials (default: config)")
    ap.add_argument("--no-arima", action="store_true", help="skip the ARIMA baseline")
    a = ap.parse_args()
    main(trials=a.trials, use_arima=not a.no_arima)
