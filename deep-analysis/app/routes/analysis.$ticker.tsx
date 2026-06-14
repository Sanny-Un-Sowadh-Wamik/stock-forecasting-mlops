import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Loader } from "lucide-react";
import {
  runPipeline,
  runDeepDiveForAnalysis,
  isCacheComplete,
  type FullAnalysis,
  type PipelineStatus,
} from "~/lib/pipeline";
import { cacheGet, cacheAge } from "~/lib/storage";
import { loadAppConfig, llmReady } from "~/lib/llm";
import { newTradeId, upsertTrade, type TradeEntry } from "~/lib/journal";
import { PriceChart } from "~/components/PriceChart";
import { SentimentPanel } from "~/components/SentimentPanel";
import { VerdictCard } from "~/components/VerdictCard";
import { Scorecard } from "~/components/Scorecard";
import { FinancialsPanel } from "~/components/FinancialsPanel";
import { ChecklistCard } from "~/components/ChecklistCard";
import { PolymarketPanel } from "~/components/PolymarketPanel";
import { RiskCalculator } from "~/components/RiskCalculator";
import { DeepDivePanel } from "~/components/DeepDivePanel";
import { Brain, BookmarkPlus, Loader as LoaderIcon } from "lucide-react";

export const Route = createFileRoute("/analysis/$ticker")({
  component: AnalysisPage,
});

const STEP_LABELS: Record<string, string> = {
  cache: "Loading cache…",
  company: "Loading company profile…",
  mmd: "Fetching OHLC data…",
  fundamentals: "Pulling 5yr financials…",
  sentiment: "Fetching news sentiment…",
  rag: "Deep-scraping articles…",
  polymarket: "Checking prediction markets…",
  claude: "Synthesizing with Claude…",
  score: "Scoring against framework…",
  done: "Analysis complete",
  error: "Error",
};

function AnalysisPage() {
  const { ticker } = Route.useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [deepRunning, setDeepRunning] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);

  const runDeep = async () => {
    if (!analysis) return;
    const config = loadAppConfig();
    if (!llmReady(config.llm)) {
      setDeepError("LLM not configured for Deep Dive. Add your model + key on the Analyze page.");
      return;
    }
    setDeepRunning(true);
    setDeepError(null);
    try {
      const updated = await runDeepDiveForAnalysis(analysis, config.llm);
      setAnalysis(updated);
    } catch (e) {
      setDeepError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeepRunning(false);
    }
  };

  const logTrade = () => {
    if (!analysis) return;
    const t: TradeEntry = {
      id: newTradeId(),
      ticker: analysis.ticker,
      thesis: analysis.verdict.thesis.thesis,
      convictionAtEntry: analysis.deepDive?.committee.conviction ?? analysis.verdict.conviction,
      entryDate: new Date().toISOString().slice(0, 10),
      entryPrice: analysis.tech.current,
      exitDate: "",
      exitPrice: null,
      shares: null,
      sentimentAtEntry: `${analysis.sentiment.netLabel} (${analysis.sentiment.netScore.toFixed(2)})`,
      catalystOutcome: "",
      technicalNote: `${analysis.tech.regime ?? "n/a"}, RSI ${(analysis.tech.rsi14 ?? 50).toFixed(0)}, ATR $${(analysis.tech.atr14 ?? analysis.tech.current * 0.02).toFixed(2)}`,
      status: "open",
      lessons: [],
      createdAt: new Date().toISOString(),
    };
    upsertTrade(t);
    setLogged(true);
  };

  const run = async (force = false) => {
    // Cache-first: a stored report renders without needing API keys.
    if (!force) {
      const cached = cacheGet<FullAnalysis>(`analysis:${ticker.toUpperCase()}`);
      if (isCacheComplete(cached)) {
        setAnalysis(cached);
        setError(null);
        setStatus({ step: "cache", detail: `cached ${cacheAge(`analysis:${ticker.toUpperCase()}`) ?? 0}m ago` });
        return;
      }
    }
    const config = loadAppConfig();
    const needApify = config.newsSource === "apify";
    if (!config.mmd || !llmReady(config.llm) || (needApify && !config.apify)) {
      setError(
        "API keys not configured. Add them on the Analyze page to run a live analysis — or load demo data from the Dashboard to explore cached reports."
      );
      return;
    }
    setRunning(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await runPipeline(
        ticker,
        {
          mmdKey: config.mmd,
          apifyKey: config.apify,
          llm: config.llm,
          newsSource: config.newsSource,
        },
        (s) => setStatus(s),
        force
      );
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  // Reset per-ticker state, then run, whenever the ticker changes.
  useEffect(() => {
    setAnalysis(null);
    setStatus(null);
    setError(null);
    setLogged(false);
    setDeepError(null);
    run(false);
  }, [ticker]);

  const isLoading = running && !analysis;

  return (
    <div>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => navigate({ to: "/" })}
          style={{
            background: "#111118",
            border: "1px solid #2a2a3a",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "#6b7280",
          }}
        >
          <ArrowLeft size={14} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>
              {ticker}
            </span>
            {analysis && (
              <span style={{ color: "#6b7280", fontSize: 13 }}>
                ${analysis.tech.current.toFixed(2)}
                {analysis.tech.asOf && (
                  <span style={{ color: "#4b5563", fontSize: 11, marginLeft: 5 }}>
                    as of {analysis.tech.asOf}
                  </span>
                )}
              </span>
            )}
            {analysis?.company?.name && analysis.company.name !== ticker && (
              <span style={{ color: "#4b5563", fontSize: 13 }}>
                {analysis.company.name}
              </span>
            )}
            {analysis?.company?.sector && analysis.company.sector !== "Unknown" && (
              <span
                style={{
                  color: "#818cf8",
                  fontSize: 11,
                  background: "#6366f118",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {analysis.company.sector}
              </span>
            )}
          </div>
          {status && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              {running && <Loader size={11} color="#6366f1" className="spin" />}
              {!running && status.step === "done" && <CheckCircle size={11} color="#22c55e" />}
              {!running && status.step === "error" && <AlertCircle size={11} color="#ef4444" />}
              <span style={{ color: "#6b7280", fontSize: 11 }}>
                {STEP_LABELS[status.step] ?? status.step} — {status.detail}
              </span>
            </div>
          )}
        </div>

        {analysis && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={logTrade}
              disabled={logged}
              style={{
                background: logged ? "#22c55e18" : "#111118",
                border: `1px solid ${logged ? "#22c55e44" : "#2a2a3a"}`,
                borderRadius: 8,
                padding: "6px 12px",
                cursor: logged ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: logged ? "#22c55e" : "#6b7280",
                fontSize: 12,
              }}
            >
              <BookmarkPlus size={13} />
              {logged ? "Logged" : "Log Trade"}
            </button>
            <button
              onClick={() => run(true)}
              disabled={running}
              style={{
                background: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: running ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#6b7280",
                fontSize: 12,
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            background: "#ef44440e",
            border: "1px solid #ef444430",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ color: "#ef4444", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              Pipeline Error
            </div>
            <div style={{ color: "#fca5a5", fontSize: 12, fontFamily: "monospace" }}>
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <LoadingSkeleton status={status} />
      )}

      {/* Results */}
      {analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Framework scorecard — headline */}
          <Scorecard scorecard={analysis.scorecard} />

          {/* Thesis + checklist */}
          <ChecklistCard scorecard={analysis.scorecard} verdict={analysis.verdict} />

          {/* Trade verdict */}
          <VerdictCard
            verdict={analysis.verdict}
            ticker={ticker}
            current={analysis.tech.current}
          />

          {/* Chart + financials side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <PriceChart tech={analysis.tech} verdict={analysis.verdict} />
            <FinancialsPanel fundamentals={analysis.fundamentals} />
          </div>

          {/* Sentiment + Polymarket cross-reference side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SentimentPanel sentiment={analysis.sentiment} />
            <PolymarketPanel snapshot={analysis.polymarket} />
          </div>

          {/* Position sizing & risk */}
          <RiskCalculator tech={analysis.tech} verdict={analysis.verdict} />

          {/* Deep Dive — Committee + Sentiment 2.0 + Catalysts + Scenarios */}
          {analysis.deepDive ? (
            <DeepDivePanel deepDive={analysis.deepDive} />
          ) : (
            <DeepDiveCTA
              onRun={runDeep}
              running={deepRunning}
              error={deepError}
            />
          )}

          {/* RAG sources */}
          {analysis.rag.length > 0 && <RagSources rag={analysis.rag} />}
        </div>
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

function DeepDiveCTA({
  onRun,
  running,
  error,
}: {
  onRun: () => void;
  running: boolean;
  error: string | null;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #6366f112, #111118)",
        border: "1px solid #6366f133",
        borderRadius: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: "#6366f120",
          borderRadius: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
        }}
      >
        <Brain size={22} color="#818cf8" />
      </div>
      <div style={{ color: "#e8e8f0", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
        Run the LLM Deep Dive
      </div>
      <div
        style={{
          color: "#6b7280",
          fontSize: 13,
          lineHeight: 1.6,
          maxWidth: 460,
          margin: "0 auto 16px",
        }}
      >
        Bull-vs-Red-Team committee debate · multi-axis sentiment · narrative & catalyst
        calendar · black-swan stress test · prediction-market cross-reference. Two extra
        Claude calls.
      </div>
      <button
        onClick={onRun}
        disabled={running}
        style={{
          background: running ? "#1a1a26" : "linear-gradient(135deg, #6366f1, #818cf8)",
          color: running ? "#6b7280" : "#fff",
          border: "none",
          borderRadius: 10,
          padding: "11px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: running ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {running ? (
          <>
            <LoaderIcon size={15} className="spin" /> Convening committee…
          </>
        ) : (
          <>
            <Brain size={15} /> Run Deep Dive
          </>
        )}
      </button>
      {error && (
        <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 12, fontFamily: "monospace" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton({ status }: { status: PipelineStatus | null }) {
  const steps = ["company", "mmd", "fundamentals", "sentiment", "rag", "polymarket", "claude", "score"];
  const currentStep = status?.step ?? "company";
  const currentIdx = steps.indexOf(currentStep);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div
            key={step}
            style={{
              background: "#111118",
              border: `1px solid ${active ? "#6366f140" : "#1e1e2e"}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: i > currentIdx ? 0.4 : 1,
            }}
          >
            {done ? (
              <CheckCircle size={16} color="#22c55e" />
            ) : active ? (
              <Loader size={16} color="#6366f1" className="spin" />
            ) : (
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid #2a2a3a",
                }}
              />
            )}
            <span style={{ color: active ? "#e8e8f0" : done ? "#22c55e" : "#4b5563", fontSize: 13 }}>
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RagSources({ rag }: { rag: { title: string; url: string; text: string }[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "14px 20px",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          SOURCE MATERIAL ({rag.length} documents)
        </span>
        <span style={{ color: "#4b5563", fontSize: 12 }}>
          {expanded ? "Hide" : "Show"}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #1e1e2e",
            padding: "12px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {rag.map((r, i) => (
            <div key={i}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#818cf8", fontSize: 12, fontWeight: 600 }}
              >
                {r.title}
              </a>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  lineHeight: 1.6,
                  marginTop: 4,
                }}
              >
                {r.text.slice(0, 400)}…
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
