import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, Key, Zap, TrendingUp, Clock, CornerDownLeft, Brain } from "lucide-react";
import { cacheGet, cacheClear } from "~/lib/storage";
import { searchTickers, type TickerMatch } from "~/lib/tickers";
import {
  loadAppConfig,
  saveAppConfig,
  llmReady,
  QWEN_PRESET,
  CLAUDE_PRESET,
  type AppConfig,
  type LLMConfig,
} from "~/lib/llm";
import type { FullAnalysis } from "~/lib/pipeline";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const DEFAULT_WATCHLIST = [
  "CRDO", "UCTT", "NVDA", "MRVL", "NBIS",
  "ASTS", "ALAB", "AVGO", "AMD", "TSM",
];

function HomePage() {
  const navigate = useNavigate();
  const [ticker, setTicker] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<AppConfig>(loadAppConfig);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<TickerMatch[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [showSug, setShowSug] = useState(false);

  // Load recents from localStorage
  useEffect(() => {
    const r = localStorage.getItem("das:recent");
    if (r) {
      try {
        setRecent(JSON.parse(r));
      } catch {}
    }
  }, []);

  const setLlm = (patch: Partial<LLMConfig>) =>
    setCfg((c) => ({ ...c, llm: { ...c.llm, ...patch } }));

  const saveKeys = () => {
    saveAppConfig(cfg);
    setShowSettings(false);
  };

  const hasCached = (t: string) => {
    return cacheGet<FullAnalysis>(`analysis:${t.toUpperCase()}`) !== null;
  };

  const go = (t: string) => {
    if (!t.trim()) return;
    const T = t.trim().toUpperCase();
    // Save to recent
    const updated = [T, ...recent.filter((r) => r !== T)].slice(0, 8);
    setRecent(updated);
    localStorage.setItem("das:recent", JSON.stringify(updated));
    setShowSug(false);
    navigate({ to: "/analysis/$ticker", params: { ticker: T } });
  };

  const onType = (raw: string) => {
    const v = raw.toUpperCase();
    setTicker(v);
    const matches = searchTickers(v, 8);
    setSuggestions(matches);
    setShowSug(matches.length > 0);
    setHighlight(-1);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!showSug || suggestions.length === 0) {
      if (e.key === "Enter") go(ticker);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(highlight >= 0 ? suggestions[highlight].symbol : ticker);
    } else if (e.key === "Escape") {
      setShowSug(false);
    }
  };

  const keysReady =
    cfg.mmd && llmReady(cfg.llm) && (cfg.newsSource !== "apify" || !!cfg.apify);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40, paddingTop: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#6366f120",
            border: "1px solid #6366f140",
            borderRadius: 20,
            padding: "4px 14px",
            fontSize: 11,
            color: "#818cf8",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <Zap size={11} /> 3-PILLAR ANALYSIS ENGINE
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#e8e8f0",
            margin: "0 0 10px",
            letterSpacing: -0.5,
          }}
        >
          Deep Stock Analysis
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
          Historic data · News sentiment · AI synthesis
        </p>
      </div>

      {/* API key warning */}
      {!keysReady && (
        <div
          style={{
            background: "#f59e0b0e",
            border: "1px solid #f59e0b30",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Key size={14} color="#f59e0b" />
          <span style={{ color: "#d97706", fontSize: 13, flex: 1 }}>
            API keys required before analysis can run.
          </span>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: "#f59e0b",
              color: "#000",
              border: "none",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Configure
          </button>
        </div>
      )}

      {/* Search */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 28,
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={16}
            color="#4b5563"
            style={{ position: "absolute", left: 14, top: 22, transform: "translateY(-50%)", zIndex: 1 }}
          />
          <input
            type="text"
            placeholder="Search ticker or company (e.g. CRDO, Nvidia)"
            value={ticker}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showSug}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKey}
            style={{
              width: "100%",
              background: "#111118",
              border: `1px solid ${showSug ? "#6366f1" : "#2a2a3a"}`,
              borderRadius: showSug ? "10px 10px 0 0" : 10,
              padding: "12px 14px 12px 40px",
              color: "#e8e8f0",
              fontSize: 15,
              fontWeight: 500,
              outline: "none",
              letterSpacing: 1,
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = "#6366f1";
              if (suggestions.length) setShowSug(true);
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = showSug ? "#6366f1" : "#2a2a3a";
              // Delay so a mousedown on a suggestion registers first.
              window.setTimeout(() => setShowSug(false), 150);
            }}
          />

          {/* Suggestions dropdown */}
          {showSug && suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#111118",
                border: "1px solid #6366f1",
                borderTop: "1px solid #2a2a3a",
                borderRadius: "0 0 10px 10px",
                overflow: "hidden",
                zIndex: 20,
                boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
              }}
            >
              {suggestions.map((s, i) => {
                const cached = hasCached(s.symbol);
                const active = i === highlight;
                return (
                  <div
                    key={s.symbol}
                    onMouseDown={(e) => {
                      e.preventDefault(); // beat the input blur
                      go(s.symbol);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      cursor: "pointer",
                      background: active ? "#1a1a26" : "transparent",
                      borderBottom: i < suggestions.length - 1 ? "1px solid #16161f" : "none",
                    }}
                  >
                    <span
                      style={{
                        color: "#e8e8f0",
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: 0.5,
                        minWidth: 64,
                      }}
                    >
                      {s.symbol}
                    </span>
                    <span
                      style={{
                        color: "#6b7280",
                        fontSize: 13,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.name}
                    </span>
                    {cached && (
                      <span
                        style={{
                          color: "#22c55e",
                          fontSize: 10,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        ● cached
                      </span>
                    )}
                    {active && <CornerDownLeft size={13} color="#818cf8" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => go(ticker)}
          disabled={!ticker.trim()}
          style={{
            background: ticker.trim() ? "linear-gradient(135deg, #6366f1, #818cf8)" : "#1a1a26",
            color: ticker.trim() ? "#fff" : "#4b5563",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: ticker.trim() ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
        >
          Analyze
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: showSettings ? "#1e1e2e" : "#111118",
            border: `1px solid ${showSettings ? "#6366f1" : "#2a2a3a"}`,
            borderRadius: 10,
            padding: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
          title="API Keys"
        >
          <Key size={16} color={showSettings ? "#818cf8" : "#6b7280"} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          style={{
            background: "#111118",
            border: "1px solid #2a2a3a",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            DATA SOURCES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <KeyInput
              label="Massive Market Data (Polygon.io) API Key"
              value={cfg.mmd}
              onChange={(v) => setCfg((c) => ({ ...c, mmd: v }))}
              placeholder="polygon_api_key..."
            />
          </div>

          {/* News source */}
          <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, margin: "18px 0 4px" }}>
            NEWS &amp; SENTIMENT SOURCE
          </div>
          <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>
            Polygon news is free (in your MMD plan) and includes sentiment. Apify adds richer
            LLM scoring + deep scrape but costs ~$0.19/analysis.
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <PresetChip
              label="Polygon (free)"
              active={cfg.newsSource !== "apify"}
              onClick={() => setCfg((c) => ({ ...c, newsSource: "polygon" }))}
            />
            <PresetChip
              label="Apify (paid, richer)"
              active={cfg.newsSource === "apify"}
              onClick={() => setCfg((c) => ({ ...c, newsSource: "apify" }))}
            />
          </div>
          {cfg.newsSource === "apify" && (
            <KeyInput
              label="Apify API Key"
              value={cfg.apify}
              onChange={(v) => setCfg((c) => ({ ...c, apify: v }))}
              placeholder="apify_api_xxx..."
            />
          )}

          {/* LLM provider */}
          <div
            style={{
              color: "#9ca3af",
              fontSize: 12,
              fontWeight: 600,
              margin: "18px 0 4px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Brain size={13} color="#818cf8" /> LLM ANALYST ENGINE
          </div>
          <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
            Runs every verdict, Deep Dive, and debrief — with a PhD-statistician / quant-finance
            system persona. Any OpenAI-compatible endpoint works.
          </div>

          {/* Preset chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <PresetChip
              label="Qwen (DashScope)"
              active={cfg.llm.provider === "openai" && cfg.llm.baseUrl.includes("aliyuncs")}
              onClick={() => setLlm({ provider: QWEN_PRESET.provider, baseUrl: QWEN_PRESET.baseUrl, model: QWEN_PRESET.model })}
            />
            <PresetChip
              label="OpenRouter"
              active={cfg.llm.baseUrl.includes("openrouter")}
              onClick={() => setLlm({ provider: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "qwen/qwen3-max" })}
            />
            <PresetChip
              label="Claude"
              active={cfg.llm.provider === "anthropic"}
              onClick={() => setLlm({ provider: CLAUDE_PRESET.provider, baseUrl: CLAUDE_PRESET.baseUrl, model: CLAUDE_PRESET.model })}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField
              label="Base URL"
              value={cfg.llm.baseUrl}
              onChange={(v) => setLlm({ baseUrl: v })}
              placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
            />
            <TextField
              label="Model"
              value={cfg.llm.model}
              onChange={(v) => setLlm({ model: v })}
              placeholder="qwen3-max"
            />
            <KeyInput
              label={`API Key (${cfg.llm.provider === "anthropic" ? "Anthropic" : "provider"})`}
              value={cfg.llm.apiKey}
              onChange={(v) => setLlm({ apiKey: v })}
              placeholder={cfg.llm.provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={saveKeys}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save Keys
            </button>
            <button
              onClick={() => {
                cacheClear();
                alert("Cache cleared.");
              }}
              style={{
                background: "#1a1a26",
                color: "#9ca3af",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#4b5563",
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            <Clock size={11} /> RECENT
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {recent.map((t) => (
              <TickerChip key={t} ticker={t} cached={hasCached(t)} onClick={go} />
            ))}
          </div>
        </div>
      )}

      {/* Watchlist */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#4b5563",
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          <TrendingUp size={11} /> WATCHLIST
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DEFAULT_WATCHLIST.map((t) => (
            <TickerChip key={t} ticker={t} cached={hasCached(t)} onClick={go} />
          ))}
        </div>
      </div>

      {/* How it works */}
      <div
        style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        {[
          {
            step: "1",
            title: "Historic Data",
            desc: "2yr OHLC bars → ATH, support, resistance, momentum",
            color: "#6366f1",
          },
          {
            step: "2",
            title: "Sentiment",
            desc: "8 articles scored → net bull/bear signal + market data",
            color: "#22c55e",
          },
          {
            step: "3",
            title: "AI Synthesis",
            desc: "Claude weighs all data → BUY/HOLD/WATCH/AVOID + targets",
            color: "#818cf8",
          },
        ].map(({ step, title, desc, color }) => (
          <div
            key={step}
            style={{
              background: "#111118",
              border: "1px solid #1e1e2e",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                background: color + "22",
                border: `1px solid ${color}40`,
                borderRadius: 6,
                color,
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              {step}
            </div>
            <div style={{ color: "#e8e8f0", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {title}
            </div>
            <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "#0a0a0f",
          border: "1px solid #2a2a3a",
          borderRadius: 8,
          padding: "8px 12px",
          color: "#e8e8f0",
          fontSize: 12,
          fontFamily: "monospace",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label style={{ color: "#6b7280", fontSize: 11, display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{
          width: "100%",
          background: "#0a0a0f",
          border: "1px solid #2a2a3a",
          borderRadius: 8,
          padding: "8px 12px",
          color: "#e8e8f0",
          fontSize: 12,
          fontFamily: "monospace",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#6366f120" : "#0a0a0f",
        border: `1px solid ${active ? "#6366f1" : "#2a2a3a"}`,
        borderRadius: 7,
        padding: "5px 12px",
        color: active ? "#818cf8" : "#9ca3af",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function TickerChip({
  ticker,
  cached,
  onClick,
}: {
  ticker: string;
  cached: boolean;
  onClick: (t: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(ticker)}
      style={{
        background: cached ? "#22c55e12" : "#111118",
        border: `1px solid ${cached ? "#22c55e30" : "#2a2a3a"}`,
        borderRadius: 7,
        padding: "5px 12px",
        color: cached ? "#22c55e" : "#9ca3af",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: 0.5,
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {ticker}
      {cached && (
        <span style={{ color: "#22c55e60", fontSize: 9 }}>●</span>
      )}
    </button>
  );
}
