"""Deploy the FastAPI prediction service to a public HF **Docker** Space.

Auth: reads the HF token from the standard cache or HF_TOKEN env var — no secret
lives in this file.

Usage:
    python scripts/deploy_hf_api.py --user Sanny2005 --space asx-forecaster-api
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent

FRONTMATTER = """---
title: ASX Forecaster API
emoji: "⚡"
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: FastAPI forecast endpoint for 10 ASX stocks
---

# ⚡ ASX Forecaster API

FastAPI service for **[stock-forecasting-mlops](https://github.com/Sanny-Un-Sowadh-Wamik/stock-forecasting-mlops)**.

- **Interactive docs:** <https://sanny2005-asx-forecaster-api.hf.space/docs>
- `GET /predict?ticker=BHP.AX&horizon=5` → JSON forecast
- `GET /models` · `GET /tickers` · `GET /health`

_Educational only — not financial advice._
"""

REQUIREMENTS = """fastapi
uvicorn[standard]
pandas>=2.1
numpy>=1.26
pyarrow>=15
xgboost>=2.0
scikit-learn>=1.4
pydantic>=2.6
pydantic-settings>=2.2
pyyaml>=6
yfinance>=0.2.40
"""

DOCKERFILE = """FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \\
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \\
    PATH=/home/user/.local/bin:$PATH \\
    PYTHONUNBUFFERED=1 \\
    PYTHONPATH=/home/user/app:/home/user/app/src
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt
COPY --chown=user . .

EXPOSE 7860
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
"""


def _stage(stage: Path) -> int:
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    for d in ("api", "src", "config"):
        shutil.copytree(ROOT / d, stage / d)
    (stage / "models").mkdir()
    for f in ("xgb_forecaster.json", "metadata.json"):
        shutil.copy(ROOT / "models" / f, stage / "models" / f)
    shutil.copytree(ROOT / "data" / "sample", stage / "data" / "sample")
    (stage / "requirements.txt").write_text(REQUIREMENTS)
    (stage / "Dockerfile").write_text(DOCKERFILE)
    (stage / "README.md").write_text(FRONTMATTER)
    for pat in ("__pycache__", "*.egg-info"):
        for p in stage.rglob(pat):
            shutil.rmtree(p, ignore_errors=True)
    for p in stage.rglob("*.pyc"):
        p.unlink()
    return sum(1 for x in stage.rglob("*") if x.is_file())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="Sanny2005")
    ap.add_argument("--space", default="asx-forecaster-api")
    args = ap.parse_args()

    repo_id = f"{args.user}/{args.space}"
    api = HfApi()
    api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)

    stage = Path("/tmp/hf_api_stage")
    n = _stage(stage)
    print(f"uploading {n} files…")
    api.upload_folder(
        folder_path=str(stage), repo_id=repo_id, repo_type="space",
        commit_message="Deploy ASX forecaster API",
    )
    print("SPACE_URL=https://huggingface.co/spaces/" + repo_id)


if __name__ == "__main__":
    main()
