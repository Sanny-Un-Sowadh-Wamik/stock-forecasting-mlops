"""Train the LSTM in an isolated process and merge its metrics into metadata.json.

Run AFTER scripts/train.py. Kept in a separate process (not folded into train.py)
because TensorFlow deadlocks when it initialises after XGBoost's OpenMP pool in the
same interpreter.

Usage:
    python scripts/train_lstm.py --epochs 12
"""

from __future__ import annotations

import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")  # CPU only

print(f"[lstm] start pid={os.getpid()} — importing base libs", flush=True)

import argparse  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402

import joblib  # noqa: E402
import pandas as pd  # noqa: E402

from stockfc.config import REPO_ROOT, load_config  # noqa: E402
from stockfc.models.dataset import build_modeling_frame, date_holdout_split  # noqa: E402

print("[lstm] stockfc imports done", flush=True)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("train_lstm")
MODELS_DIR = REPO_ROOT / "models"


def main(epochs: int = 12, lookback: int = 20) -> None:
    cfg = load_config()

    feat_path = cfg.data.processed_dir / "features.parquet"
    df = pd.read_parquet(feat_path) if feat_path.exists() else build_modeling_frame(cfg)
    print(f"[lstm] features loaded: {len(df)} rows", flush=True)
    _, _, cutoff = date_holdout_split(df, cfg.model.test_size)

    meta_path = MODELS_DIR / "metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    cols = meta.get("feature_columns")
    if not cols:
        from stockfc.features import feature_columns

        cols = feature_columns(df)

    print("[lstm] importing tensorflow…", flush=True)
    import tensorflow as tf

    print(f"[lstm] tensorflow {tf.__version__} ready; building + training", flush=True)

    from stockfc.models.lstm_model import train_lstm

    metrics, model, scaler = train_lstm(
        df, cols, cutoff, lookback=lookback, epochs=epochs, random_state=cfg.model.random_state
    )
    print(f"[lstm] done → {metrics}", flush=True)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model.save(str(MODELS_DIR / "lstm_forecaster.keras"))
    joblib.dump(scaler, MODELS_DIR / "lstm_scaler.joblib")

    meta.setdefault("metrics", {})["lstm"] = metrics
    meta["lstm_lookback"] = lookback
    meta_path.write_text(json.dumps(meta, indent=2))
    print(f"[lstm] merged metrics → {meta_path}", flush=True)

    try:
        from stockfc.models import registry

        registry.init_mlflow()
        registry.log_model_run("lstm", {"lookback": lookback, "epochs": epochs}, metrics)
    except Exception as exc:  # noqa: BLE001
        log.warning("MLflow logging skipped: %s", exc)

    print("\nUpdated model comparison (price RMSE | directional accuracy):", flush=True)
    for name, m in meta["metrics"].items():
        print(f"  {name:<12} {m['price_rmse']:.4f} | {m['directional_accuracy'] * 100:.2f}%")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--lookback", type=int, default=20)
    a = ap.parse_args()
    main(epochs=a.epochs, lookback=a.lookback)
