"""Typed configuration for the forecasting pipeline.

Plain parameters are read from ``config/config.yaml`` and validated into pydantic
models; secrets are read from the environment / ``.env`` via pydantic-settings.
Paths are resolved relative to the repository root so the package works the same
no matter what the current working directory is.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

# src/stockfc/config.py -> parents[1] == repo root
PACKAGE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_ROOT.parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "config" / "config.yaml"


class DataConfig(BaseModel):
    tickers: list[str]
    start_date: str
    end_date: str | None = None
    interval: str = "1d"
    cache_days: int = 1
    raw_dir: Path = REPO_ROOT / "data" / "raw"
    processed_dir: Path = REPO_ROOT / "data" / "processed"
    sample_dir: Path = REPO_ROOT / "data" / "sample"


class FeatureConfig(BaseModel):
    sma_windows: list[int] = [7, 30]
    ema_windows: list[int] = [12, 26]
    rsi_period: int = 14
    bb_window: int = 20
    bb_std: float = 2.0
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    return_lags: list[int] = [1, 2, 3, 5, 10]
    target_horizon: int = 1
    target_kind: Literal["log_return", "price"] = "log_return"


class ModelConfig(BaseModel):
    test_size: float = 0.2
    cv_splits: int = 5
    random_state: int = 42
    optuna_trials: int = 30
    registry_name: str = "asx-forecaster"


class AppConfig(BaseModel):
    project_name: str = "stock-forecasting-mlops"
    data: DataConfig
    features: FeatureConfig = FeatureConfig()
    model: ModelConfig = ModelConfig()


class Settings(BaseSettings):
    """Secrets / runtime settings (never committed)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    newsapi_key: str | None = None
    alphavantage_key: str | None = None
    # SQLite backend = MLflow's modern default (the file store is deprecated in 3.x
    # and unlocks the model registry). Relative to the working directory.
    mlflow_tracking_uri: str = "sqlite:///mlflow.db"


@lru_cache
def load_config(path: str | Path = DEFAULT_CONFIG_PATH) -> AppConfig:
    """Load and validate the project configuration (cached)."""
    with open(path) as fh:
        raw = yaml.safe_load(fh)
    return AppConfig(**raw)


@lru_cache
def get_settings() -> Settings:
    return Settings()
