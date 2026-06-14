import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  RefreshCw,
  Loader,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  loadMarket,
  deriveViews,
  searchMarket,
  marketCacheAgeMin,
  type MarketSnapshot,
  type MarketRow,
} from "~/lib/market";
import { loadAppConfig } from "~/lib/llm";

export const Route = createFileRoute("/market")({
  component: MarketPage,
});

type Tab = "gainers" | "losers" | "active" | "search";

function MarketPage() {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("gainers");
  const [query, setQuery] = useState("");

  const run = async (force = false) => {
    const key = loadAppConfig().mmd;
    if (!key) {
      setError("Massive Market Data key not set. Add it on the Analyze page (⚙) first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loadMarket(key, (m) => setStatus(m), force);
      setSnap(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run(false);
  }, []);

  const views = useMemo(() => (snap ? deriveViews(snap.rows) : null), [snap]);
  const searchResults = useMemo(
    () => (snap && query ? searchMarket(snap.rows, query) : []),
    [snap, query]
  );

  // When the user types, switch to the search tab automatically.
  useEffect(() => {
    if (query) setTab("search");
  }, [query]);

  const rows: MarketRow[] =
    tab === "search"
      ? searchResults
      : tab === "gainers"
        ? views?.gainers ?? []
        : tab === "losers"
          ? views?.losers ?? []
          : views?.mostActive ?? [];

  const onSelect = (t: string) =>
    navigate({ to: "/analysis/$ticker", params: { ticker: t } });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              color: "#e8e8f0",
              fontWeight: 800,
              fontSize: 24,
              margin: "0 0 4px",
              letterSpacing: -0.5,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Globe size={22} color="#818cf8" /> Market Dashboard
          </h2>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            {snap
              ? `${snap.total.toLocaleString()} US stocks · as of ${snap.date}${snap.prevDate ? ` (vs ${snap.prevDate})` : ""}`
              : "Every US stock, one snapshot — powered by grouped daily bars"}
          </p>
        </div>
        {snap && (
          <button
            onClick={() => run(true)}
            disabled={loading}
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#9ca3af",
              fontSize: 12,
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#ef44440e",
            border: "1px solid #ef444430",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            gap: 10,
            marginBottom: 20,
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>
        </div>
      )}

      {/* Loading */}
      {loading && !snap && (
        <div
          style={{
            background: "#111118",
            border: "1px solid #6366f140",
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
          }}
        >
          <Loader size={24} color="#6366f1" className="spin" style={{ marginBottom: 12 }} />
          <div style={{ color: "#e8e8f0", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Loading the whole market…
          </div>
          <div style={{ color: "#6b7280", fontSize: 12 }}>{status}</div>
          <div style={{ color: "#4b5563", fontSize: 11, marginTop: 8 }}>
            2 API calls, ~12s apart (5/min limit). Cached after first load.
          </div>
        </div>
      )}

      {snap && views && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <SummaryCard
              icon={<Globe size={15} color="#6366f1" />}
              label="Stocks"
              ticker={snap.total.toLocaleString()}
              color="#6366f1"
              onClick={() => setTab("active")}
            />
            <MoverCard
              icon={<TrendingUp size={15} color="#22c55e" />}
              label="Top Gainer"
              row={views.gainers[0]}
              color="#22c55e"
              onClick={(t) => onSelect(t)}
            />
            <MoverCard
              icon={<TrendingDown size={15} color="#ef4444" />}
              label="Top Loser"
              row={views.losers[0]}
              color="#ef4444"
              onClick={(t) => onSelect(t)}
            />
            <MoverCard
              icon={<Activity size={15} color="#f59e0b" />}
              label="Most Active"
              row={views.mostActive[0]}
              color="#f59e0b"
              showVolume
              onClick={(t) => onSelect(t)}
            />
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search
              size={15}
              color="#4b5563"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder="Search all 12k+ stocks by ticker or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                background: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: 10,
                padding: "10px 14px 10px 38px",
                color: "#e8e8f0",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <TabButton active={tab === "gainers"} onClick={() => { setTab("gainers"); setQuery(""); }} label="Top Gainers" />
            <TabButton active={tab === "losers"} onClick={() => { setTab("losers"); setQuery(""); }} label="Top Losers" />
            <TabButton active={tab === "active"} onClick={() => { setTab("active"); setQuery(""); }} label="Most Active" />
            {tab === "search" && <TabButton active label={`Search "${query}"`} onClick={() => {}} />}
          </div>

          {/* Table */}
          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 90px 1fr 100px 90px 110px 28px",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid #1e1e2e",
                color: "#4b5563",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <span>#</span>
              <span>TICKER</span>
              <span>NAME</span>
              <span style={{ textAlign: "right" }}>PRICE</span>
              <span style={{ textAlign: "right" }}>CHANGE</span>
              <span style={{ textAlign: "right" }}>$ VOLUME</span>
              <span />
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                {tab === "search" ? "No matching stocks." : "No data."}
              </div>
            ) : (
              rows.map((r, i) => (
                <MarketRowItem key={r.ticker} row={r} rank={i + 1} onClick={() => onSelect(r.ticker)} />
              ))
            )}
          </div>

          <div style={{ color: "#4b5563", fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
            EOD grouped data. Gainers/losers filtered to ≥$1M daily $-volume to exclude
            illiquid penny-stock noise. Click any row for full analysis.
            {marketCacheAgeMin() != null && ` · cached ${marketCacheAgeMin()}m ago`}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function MarketRowItem({
  row,
  rank,
  onClick,
}: {
  row: MarketRow;
  rank: number;
  onClick: () => void;
}) {
  const c = row.changePct;
  const color = c == null ? "#6b7280" : c >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "40px 90px 1fr 100px 90px 110px 28px",
        gap: 10,
        padding: "11px 16px",
        borderBottom: "1px solid #16161f",
        cursor: "pointer",
        alignItems: "center",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#1a1a26")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <span style={{ color: "#4b5563", fontSize: 12 }}>{rank}</span>
      <span style={{ color: "#e8e8f0", fontWeight: 700, fontSize: 14 }}>{row.ticker}</span>
      <span
        style={{
          color: "#6b7280",
          fontSize: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.name ?? "—"}
      </span>
      <span style={{ color: "#e8e8f0", fontSize: 13, textAlign: "right" }}>
        ${row.close.toFixed(2)}
      </span>
      <span style={{ color, fontSize: 13, fontWeight: 700, textAlign: "right" }}>
        {c == null ? "—" : `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`}
      </span>
      <span style={{ color: "#9ca3af", fontSize: 12, textAlign: "right" }}>
        {fmtDollarVol(row.dollarVolume)}
      </span>
      <ArrowRight size={13} color="#4b5563" />
    </div>
  );
}

function fmtDollarVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function SummaryCard({
  icon,
  label,
  ticker,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  ticker: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            background: color + "18",
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{label}</span>
      </div>
      <div style={{ color: "#e8e8f0", fontSize: 22, fontWeight: 800 }}>{ticker}</div>
    </div>
  );
}

function MoverCard({
  icon,
  label,
  row,
  color,
  showVolume,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  row: MarketRow | undefined;
  color: string;
  showVolume?: boolean;
  onClick: (t: string) => void;
}) {
  return (
    <div
      onClick={() => row && onClick(row.ticker)}
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: "14px 16px",
        cursor: row ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            background: color + "18",
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{label}</span>
      </div>
      {row ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ color: "#e8e8f0", fontSize: 20, fontWeight: 800 }}>{row.ticker}</span>
          <span style={{ color, fontSize: 13, fontWeight: 700 }}>
            {showVolume
              ? fmtDollarVol(row.dollarVolume)
              : row.changePct != null
                ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(1)}%`
                : ""}
          </span>
        </div>
      ) : (
        <div style={{ color: "#4b5563", fontSize: 14 }}>—</div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#6366f120" : "#111118",
        border: `1px solid ${active ? "#6366f1" : "#2a2a3a"}`,
        borderRadius: 8,
        padding: "7px 14px",
        color: active ? "#818cf8" : "#9ca3af",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
