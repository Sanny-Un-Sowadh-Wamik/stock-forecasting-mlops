# Deployment runbook

Everything here is **free tier**. We run these together — you do the browser logins,
I run the commands.

## 0. Push to GitHub (once)

```bash
gh auth login                      # one-time browser login (or ensure your SSH key is on GitHub)
git init -b main && git add -A
git commit -m "feat: ASX stock forecasting with MLOps (Project 1)"
git remote add origin git@github.com:Sanny-Un-Sowadh-Wamik/stock-forecasting-mlops.git
git push -u origin main
# If the GitHub repo doesn't exist yet, instead run:
#   gh repo create stock-forecasting-mlops --public --source . --remote origin --push
```

## 1. Dashboard → Streamlit Community Cloud (free)

1. Go to <https://share.streamlit.io> → sign in with GitHub.
2. **New app** → pick this repo, branch `main`, main file `dashboard/app.py`.
3. (Optional) **Advanced → Secrets**: `API_URL = "https://<your-space>.hf.space"` to link the live API.
4. Deploy → you get `https://<app>.streamlit.app`. Put it in the README badge + your resume.

`requirements.txt` at the repo root is detected automatically. The app adds `src/` to
`sys.path`, so no package install is needed.

## 2. API → Hugging Face Spaces (Docker SDK, free)

The serving image is defined by the repo `Dockerfile` (listens on `$PORT`, default 7860).

1. Create a free account at <https://huggingface.co/join>.
2. `pip install huggingface_hub` then `huggingface-cli login` (paste a write token).
3. Create a **Docker** Space and push the build context:
   ```bash
   huggingface-cli repo create asx-forecaster-api --type space --space_sdk docker
   # add the Space README frontmatter (title/emoji/sdk: docker/app_port: 7860),
   # then push the Dockerfile + src/ + api/ + config/ + models/ + data/sample/
   ```
4. The Space builds the image and serves `https://<user>-asx-forecaster-api.hf.space`.
   Interactive docs at `…/docs` — the link to share with recruiters.

> The committed `models/` + `data/sample/` make the image fully self-contained — it serves
> forecasts with **no network calls and no API keys**.

## 3. MLflow UI (local, for screenshots)

```bash
make mlflow      # mlflow ui --backend-store-uri sqlite:///mlflow.db  → http://localhost:5000
```

Screenshot the experiment comparison + the registered `asx-forecaster` model for the README.
