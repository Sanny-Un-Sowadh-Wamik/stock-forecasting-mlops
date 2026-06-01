"""Make the `stockfc` (src layout) and `api` packages importable in tests
without requiring an editable install (also helps some CI runners)."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
for _p in (ROOT, ROOT / "src"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
