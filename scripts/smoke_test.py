"""End-to-end sanity check: ingest two tickers and build a feature matrix.

Run:  python scripts/smoke_test.py
"""

import logging

from stockfc.config import load_config
from stockfc.data import ingest_all
from stockfc.features import build_feature_matrix, feature_columns

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def main() -> None:
    cfg = load_config()
    cfg.data.tickers = cfg.data.tickers[:2]  # keep the smoke test fast

    prices = ingest_all(cfg)
    print(f"\n✓ Ingested {len(prices):,} rows across {prices['ticker'].nunique()} tickers")
    print(prices.groupby("ticker").size().to_string())

    first = cfg.data.tickers[0]
    one = prices[prices["ticker"] == first].set_index("date")
    feats = build_feature_matrix(one, cfg.features)
    cols = feature_columns(feats)
    print(f"\n✓ Feature matrix for {first}: {feats.shape[0]:,} rows × {len(cols)} features")
    preview = ["close", "log_return", "rsi_14", "macd", "bb_pctb", "target"]
    print(feats[preview].tail(3).round(4).to_string())
    print("\nSmoke test passed ✅")


if __name__ == "__main__":
    main()
