"""LSTM forecaster (Keras) — a pooled sequence model over all tickers.

Trained with a **manual eager GradientTape loop** rather than ``model.fit``: Keras's
``fit`` data-adapter spins up background threads that deadlock on some Apple-Silicon
TensorFlow builds. The manual loop executes ops directly and is deadlock-resistant.

TensorFlow is imported lazily so the rest of the package (and the slim serving image)
never needs it. Install with ``uv pip install -e ".[dl]"``.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from stockfc.models.evaluate import evaluate_return_model

logger = logging.getLogger(__name__)


def _sequences_for_ticker(arr, target, close, dates, lookback):
    seqs, ys, cs, ds = [], [], [], []
    for i in range(lookback - 1, len(arr)):
        seqs.append(arr[i - lookback + 1 : i + 1])  # `lookback` rows ending at day i
        ys.append(target[i])  # predict the return realised after day i
        cs.append(close[i])
        ds.append(dates[i])
    return np.asarray(seqs), np.asarray(ys), np.asarray(cs), np.asarray(ds)


def build_sequences(df: pd.DataFrame, feature_cols, cutoff, lookback, scaler):
    """Build train/test sequence tensors, split by the same global date cutoff."""
    cut = np.datetime64(pd.Timestamp(cutoff))
    Xtr, ytr, Xte, yte, cte = [], [], [], [], []
    for _, g in df.groupby("ticker"):
        g = g.sort_values("date")
        arr = scaler.transform(g[feature_cols].to_numpy())
        seqs, ys, cs, ds = _sequences_for_ticker(
            arr, g["target"].to_numpy(), g["close"].to_numpy(), g["date"].to_numpy(), lookback
        )
        is_train = ds < cut
        Xtr.append(seqs[is_train])
        ytr.append(ys[is_train])
        Xte.append(seqs[~is_train])
        yte.append(ys[~is_train])
        cte.append(cs[~is_train])
    return (
        np.concatenate(Xtr).astype("float32"),
        np.concatenate(ytr).astype("float32"),
        np.concatenate(Xte).astype("float32"),
        np.concatenate(yte).astype("float32"),
        np.concatenate(cte).astype("float32"),
    )


def train_lstm(
    df: pd.DataFrame,
    feature_cols: list[str],
    cutoff: pd.Timestamp,
    lookback: int = 20,
    epochs: int = 12,
    batch_size: int = 256,
    random_state: int = 42,
):
    """Train a pooled LSTM (manual eager loop) and return (metrics, model, scaler)."""
    try:
        import tensorflow as tf
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("TensorFlow not installed — run: uv pip install -e '.[dl]'") from exc

    tf.keras.utils.set_random_seed(random_state)

    scaler = StandardScaler().fit(df[df["date"] < cutoff][feature_cols].to_numpy())
    Xtr, ytr, Xte, yte, cte = build_sequences(df, feature_cols, cutoff, lookback, scaler)
    logger.info("LSTM tensors — train=%s test=%s", Xtr.shape, Xte.shape)

    # Time-ordered validation split (last 15% of training sequences).
    n_val = max(1, int(len(Xtr) * 0.15))
    Xval, yval = Xtr[-n_val:], ytr[-n_val:]
    Xtr2, ytr2 = Xtr[:-n_val], ytr[:-n_val]

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(lookback, len(feature_cols))),
            tf.keras.layers.LSTM(32),
            tf.keras.layers.Dropout(0.1),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    optimizer = tf.keras.optimizers.Adam(learning_rate=1e-3)

    def _step(xb, yb):
        with tf.GradientTape() as tape:
            loss = tf.reduce_mean(tf.square(model(xb, training=True) - yb))
        grads = tape.gradient(loss, model.trainable_variables)
        optimizer.apply_gradients(zip(grads, model.trainable_variables, strict=False))

    rng = np.random.default_rng(random_state)
    idx = np.arange(len(Xtr2))
    best_val, best_weights, wait, patience = float("inf"), None, 0, 3

    for epoch in range(epochs):
        rng.shuffle(idx)
        for start in range(0, len(idx), batch_size):
            b = idx[start : start + batch_size]
            _step(tf.constant(Xtr2[b]), tf.constant(ytr2[b].reshape(-1, 1)))
        val_pred = model(tf.constant(Xval), training=False).numpy().ravel()
        val_loss = float(np.mean((val_pred - yval) ** 2))
        print(f"[lstm] epoch {epoch + 1}/{epochs}  val_mse={val_loss:.6e}", flush=True)
        if val_loss < best_val - 1e-9:
            best_val, best_weights, wait = val_loss, model.get_weights(), 0
        else:
            wait += 1
            if wait >= patience:
                print(f"[lstm] early stop at epoch {epoch + 1}", flush=True)
                break

    if best_weights is not None:
        model.set_weights(best_weights)

    pred = model(tf.constant(Xte), training=False).numpy().ravel()
    metrics = evaluate_return_model(pd.DataFrame({"close": cte, "target": yte}), pred)
    return metrics, model, scaler
