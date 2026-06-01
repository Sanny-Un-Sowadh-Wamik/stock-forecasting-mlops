.PHONY: help setup data train test lint format api app mlflow docker-build docker-run sample clean

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n",$$1,$$2}'

setup:  ## Create the venv and install every extra
	uv venv --python 3.11 && uv pip install -e ".[models,api,app,dl,dev]"

data:  ## Build the pooled modelling dataset
	python -c "from stockfc.models.dataset import build_modeling_frame as b; b()"

train:  ## Train + evaluate all models and log to MLflow
	python scripts/train.py

test:  ## Run the test suite
	pytest -q

lint:  ## Ruff + mypy
	ruff check . && mypy src

format:  ## Auto-format and fix
	ruff format . && ruff check --fix .

api:  ## Run the FastAPI service locally on :8000
	uvicorn api.main:app --reload --port 8000

app:  ## Run the Streamlit dashboard
	streamlit run dashboard/app.py

mlflow:  ## Open the MLflow tracking UI
	mlflow ui --backend-store-uri sqlite:///mlflow.db

sample:  ## Refresh the committed offline sample dataset
	python -c "from stockfc.data import build_sample_dataset as b; print(b(n_tickers=10))"

docker-build:  ## Build the API serving image
	docker build -t asx-forecaster-api .

docker-run:  ## Run the API image on :7860
	docker run -p 7860:7860 asx-forecaster-api

clean:  ## Remove caches and local tracking artifacts
	rm -rf .pytest_cache .ruff_cache .mypy_cache mlruns mlartifacts mlflow.db
	find . -type d -name __pycache__ -exec rm -rf {} +
