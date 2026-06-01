"""Global XGBoost log-return forecaster with Optuna hyper-parameter tuning.

Tuning uses ``TimeSeriesSplit`` so every validation fold is strictly in the
future of its training fold — the correct cross-validation for time series.
"""

from __future__ import annotations

import logging

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit

logger = logging.getLogger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)

_FIXED = {"n_jobs": -1, "tree_method": "hist", "objective": "reg:squarederror"}


def _cv_rmse(params: dict, X: pd.DataFrame, y: pd.Series, n_splits: int) -> float:
    tss = TimeSeriesSplit(n_splits=n_splits)
    scores = []
    for tr, va in tss.split(X):
        model = xgb.XGBRegressor(**params)
        model.fit(X.iloc[tr], y.iloc[tr])
        pred = model.predict(X.iloc[va])
        scores.append(np.sqrt(np.mean((pred - y.iloc[va].to_numpy()) ** 2)))
    return float(np.mean(scores))


def tune_xgboost(
    X: pd.DataFrame, y: pd.Series, n_trials: int = 30, n_splits: int = 5, random_state: int = 42
) -> tuple[dict, float]:
    """Return (best_params, best_cv_rmse)."""

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 900, step=100),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "random_state": random_state,
            **_FIXED,
        }
        return _cv_rmse(params, X, y, n_splits)

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params, study.best_value


def train_xgboost(X: pd.DataFrame, y: pd.Series, params: dict, random_state: int = 42) -> xgb.XGBRegressor:
    model = xgb.XGBRegressor(**{**params, "random_state": random_state, **_FIXED})
    model.fit(X, y)
    return model
