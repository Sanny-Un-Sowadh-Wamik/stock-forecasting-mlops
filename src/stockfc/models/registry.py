"""Thin MLflow helpers for experiment tracking + the model registry.

Submodules are imported at module top (not inside functions) — importing
``mlflow.xgboost`` inside a function would rebind the name ``mlflow`` to a local
and shadow the earlier ``mlflow.start_run`` call (an UnboundLocalError trap).
"""

from __future__ import annotations

import logging

import mlflow
import mlflow.sklearn
import mlflow.xgboost

from stockfc.config import get_settings

logger = logging.getLogger(__name__)


def init_mlflow(experiment: str = "asx-forecasting") -> None:
    mlflow.set_tracking_uri(get_settings().mlflow_tracking_uri)
    mlflow.set_experiment(experiment)


def _log_model(flavor_module, model, registered_name: str | None) -> None:
    # `name=` is the MLflow 3.x kwarg; `artifact_path` positional is the 2.x form.
    try:
        flavor_module.log_model(model, name="model", registered_model_name=registered_name)
    except TypeError:
        flavor_module.log_model(model, "model", registered_model_name=registered_name)


def log_model_run(
    name: str,
    params: dict,
    metrics: dict,
    model=None,
    flavor: str = "sklearn",
    registered_name: str | None = None,
) -> None:
    """Log one run (params + metrics, optionally the model artifact)."""
    with mlflow.start_run(run_name=name):
        if params:
            mlflow.log_params(params)
        mlflow.log_metrics(metrics)
        if model is not None:
            _log_model(mlflow.xgboost if flavor == "xgboost" else mlflow.sklearn, model, registered_name)
