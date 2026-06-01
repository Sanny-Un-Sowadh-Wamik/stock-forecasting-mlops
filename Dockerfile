# Lightweight serving image for the FastAPI prediction service.
# Deploys to Hugging Face Spaces (Docker SDK, default port 7860) — free tier.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# libgomp1 is required by XGBoost's OpenMP runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching).
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install -e ".[api]"

# App code + committed model artifacts + offline sample data.
COPY api ./api
COPY config ./config
COPY models ./models
COPY data/sample ./data/sample

EXPOSE 7860
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
