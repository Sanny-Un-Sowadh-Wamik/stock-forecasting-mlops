"""Market-data ingestion."""

from stockfc.data.ingest import (
    build_sample_dataset,
    fetch_ticker,
    ingest_all,
    load_prices,
)

__all__ = ["fetch_ticker", "ingest_all", "load_prices", "build_sample_dataset"]
