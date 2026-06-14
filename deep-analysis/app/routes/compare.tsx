import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Play, X, RefreshCw, Loader } from "lucide-react";
import { runBatch, type FullAnalysis, type PipelineStatus } from "~/lib/pipeline";
import { loadAppConfig, llmReady } from "~/lib/llm";
import { CompareTable } from "~/components/CompareTable";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
});

const PRESET_LISTS = {
  "Semiconductors": ["CRDO", "UCTT", "NVDA", "MRVL", "ALAB", "AVGO", "AMD", "TSM"],
  "AI Infrastructure": ["NVDA", "ALAB", "MRVL", "CRDO", "ASTS", "NBIS"],
  "My Watchlist": ["CRDO", "UCTT", "NVDA", "MRVL", "NBIS", "ASTS"],
};

function ComparePage() {
  const navigate = useNavigate();
  const [tickers, setTickers] = useState<string[]>(["CRDO", "NVDA", "MRVL"]);
  const [input, setInput] = useState("");
  const [analyses, setAnalyses] = useState<FullAnalysis[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const add = (t: string) => {
    const T = t.trim().toUpperCase();
    if (!T || tickers.includes(T)) return;
    setTickers((prev) => [...prev, T]);
    setInput("");
  };

  const remove = (t: string) => setTickers((prev) => prev.filter((x) => x !== t));

  const run = async () => {
    const config = loadAppConfig();
    const needApify = config.newsSource === "apify";
    if (!config.mmd || !llmReady(config.llm) || (needApify && !config.apify)) {
      setError("API keys not configured — go to Analyze page first.");
      return;
    }
    setRunning(true);
    setError(null);
    setProgress({});
    setAnalyses([]);
    try {
      const results = await runBatch(
        tickers,
        {
          mmdKey: config.mmd,
          apifyKey: config.apify,
          llm: config.llm,
          newsSource: config.newsSource,
        },
        (ticker, s) => setProgress((p) => ({ ...p, [ticker]: s.detail }))
      );
      setAnalyses(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            color: "#e8e8f0",
            fontWeight: 800,
            fontSize: 22,
            margin: "0 0 6px",
            letterSpacing: -0.5,
          }}
        >
          Compare Tickers
        </h2>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
          Run full 3-pillar analysis on multiple stocks → ranked by composite score
        </p>
      </div>

      {/* Ticker builder */}
      <div
        style={{
          background: "#111118",
          border: "1px solid #2a2a3a",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, marginBottom: 12 }}
        >
          TICKER LIST
        </div>

        {/* Preset buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {Object.entries(PRESET_LISTS).map(([name, list]) => (
            <button
              key={name}
              onClick={() => setTickers(list)}
              style={{
                background: "#1a1a26",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                padding: "4px 10px",
                color: "#9ca3af",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Selected tickers */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {tickers.map((t) => (
            <div
              key={t}
              style={{
                background: "#1a1a26",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: "#e8e8f0", fontWeight: 700, fontSize: 13 }}>
                {t}
              </span>
              {running && progress[t] && (
                <span style={{ color: "#6b7280", fontSize: 10 }}>
                  {progress[t].slice(0, 20)}
                </span>
              )}
              <button
                onClick={() => remove(t)}
                disabled={running}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                }}
              >
                <X size={12} color="#4b5563" />
              </button>
            </div>
          ))}
        </div>

        {/* Add input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Add ticker…"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && add(input)}
            style={{
              background: "#0a0a0f",
              border: "1px solid #2a2a3a",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#e8e8f0",
              fontSize: 13,
              fontWeight: 600,
              width: 140,
              outline: "none",
              letterSpacing: 0.5,
            }}
          />
          <button
            onClick={() => add(input)}
            style={{
              background: "#1a1a26",
              border: "1px solid #2a2a3a",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#9ca3af",
              fontSize: 12,
            }}
          >
            <Plus size={14} /> Add
          </button>
          <button
            onClick={run}
            disabled={running || tickers.length === 0}
            style={{
              background:
                running || tickers.length === 0
                  ? "#1a1a26"
                  : "linear-gradient(135deg, #6366f1, #818cf8)",
              color: running || tickers.length === 0 ? "#4b5563" : "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: running || tickers.length === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginLeft: "auto",
            }}
          >
            {running ? (
              <>
                <Loader size={14} className="spin" />
                Running ({Object.keys(progress).length}/{tickers.length})
              </>
            ) : (
              <>
                <Play size={14} />
                Run Analysis
              </>
            )}
          </button>
        </div>

        {/* Rate limit note */}
        {tickers.length > 5 && (
          <div style={{ color: "#4b5563", fontSize: 11, marginTop: 8 }}>
            MMD rate limit: 5 calls/min — {tickers.length} tickers ≈{" "}
            {Math.ceil((tickers.length * 2) / 5)} min to complete
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#ef44440e",
            border: "1px solid #ef444430",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#fca5a5",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Results table */}
      {analyses.length > 0 && (
        <CompareTable
          analyses={analyses}
          onSelect={(t) =>
            navigate({ to: "/analysis/$ticker", params: { ticker: t } })
          }
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
