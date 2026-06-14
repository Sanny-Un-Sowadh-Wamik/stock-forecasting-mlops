import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutGrid,
  Trophy,
  Target,
  TrendingUp,
  Sparkles,
  RefreshCw,
  ArrowRight,
  PieChart,
} from "lucide-react";
import { loadAllCached, type FullAnalysis } from "~/lib/pipeline";
import { loadDemoIntoCache } from "~/lib/demo";
import { scoreTier } from "~/lib/scoring";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<FullAnalysis[]>([]);

  const reload = () => setAnalyses(loadAllCached());

  useEffect(() => {
    reload();
  }, []);

  const loadDemo = () => {
    loadDemoIntoCache();
    reload();
  };

  if (analyses.length === 0) {
    return <EmptyState onLoadDemo={loadDemo} onAnalyze={() => navigate({ to: "/" })} />;
  }

  const candidates = analyses.filter((a) => a.scorecard.isCandidate);
  const avgScore =
    analyses.reduce((s, a) => s + a.scorecard.weighted, 0) / analyses.length;
  const best = analyses[0];

  // Sector allocation
  const sectorMap = new Map<string, number>();
  analyses.forEach((a) => {
    const s = a.company.sector || "Unknown";
    sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1);
  });
  const sectors = [...sectorMap.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
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
            <LayoutGrid size={22} color="#818cf8" /> Portfolio Dashboard
          </h2>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            {analyses.length} stocks analyzed · weighted on a fundamentals-first framework
          </p>
        </div>
        <button
          onClick={reload}
          style={{
            background: "#111118",
            border: "1px solid #2a2a3a",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#9ca3af",
            fontSize: 12,
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatCard
          icon={<LayoutGrid size={16} color="#6366f1" />}
          label="Analyzed"
          value={String(analyses.length)}
          color="#6366f1"
        />
        <StatCard
          icon={<Trophy size={16} color="#22c55e" />}
          label="Candidates (8.0+)"
          value={String(candidates.length)}
          color="#22c55e"
        />
        <StatCard
          icon={<Target size={16} color="#818cf8" />}
          label="Avg Score"
          value={avgScore.toFixed(1)}
          color="#818cf8"
        />
        <StatCard
          icon={<TrendingUp size={16} color="#f59e0b" />}
          label="Top Pick"
          value={best.ticker}
          sub={`${best.scorecard.weighted.toFixed(1)}/10`}
          color="#f59e0b"
        />
      </div>

      {/* Candidates highlight */}
      {candidates.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel icon={<Sparkles size={13} />} text="INVESTMENT CANDIDATES" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(candidates.length, 3)}, 1fr)`,
              gap: 12,
            }}
          >
            {candidates.slice(0, 3).map((a) => (
              <CandidateCard
                key={a.ticker}
                analysis={a}
                onClick={() =>
                  navigate({ to: "/analysis/$ticker", params: { ticker: a.ticker } })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Two-column: table + sector */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 16 }}>
        {/* Ranked table */}
        <div>
          <SectionLabel icon={<LayoutGrid size={13} />} text="ALL HOLDINGS — RANKED" />
          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {analyses.map((a, i) => (
              <HoldingRow
                key={a.ticker}
                analysis={a}
                rank={i + 1}
                onClick={() =>
                  navigate({ to: "/analysis/$ticker", params: { ticker: a.ticker } })
                }
              />
            ))}
          </div>
        </div>

        {/* Sector allocation */}
        <div>
          <SectionLabel icon={<PieChart size={13} />} text="SECTOR MIX" />
          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: 12,
              padding: 16,
            }}
          >
            {sectors.map(([name, count]) => (
              <div key={name} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      color: "#9ca3af",
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 200,
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ color: "#6b7280", fontSize: 11 }}>{count}</span>
                </div>
                <div
                  style={{
                    background: "#1a1a26",
                    borderRadius: 3,
                    height: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(count / analyses.length) * 100}%`,
                      height: "100%",
                      background: "#6366f1",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={loadDemo}
              style={{
                marginTop: 8,
                width: "100%",
                background: "#1a1a26",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                padding: "8px",
                color: "#6b7280",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              + Load sample data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ color: "#e8e8f0", fontSize: 24, fontWeight: 800 }}>{value}</span>
        {sub && <span style={{ color, fontSize: 13, fontWeight: 600 }}>{sub}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "#4b5563",
        fontSize: 11,
        fontWeight: 700,
        marginBottom: 10,
        letterSpacing: 0.5,
      }}
    >
      {icon} {text}
    </div>
  );
}

function CandidateCard({
  analysis,
  onClick,
}: {
  analysis: FullAnalysis;
  onClick: () => void;
}) {
  const a = analysis;
  return (
    <div
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, #22c55e10, #111118)",
        border: "1px solid #22c55e35",
        borderRadius: 12,
        padding: 16,
        cursor: "pointer",
        transition: "transform 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = "translateY(0)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 18 }}>{a.ticker}</div>
          <div
            style={{
              color: "#6b7280",
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 160,
            }}
          >
            {a.company.name}
          </div>
        </div>
        <div
          style={{
            background: "#22c55e",
            color: "#000",
            fontWeight: 800,
            fontSize: 16,
            borderRadius: 8,
            padding: "4px 10px",
          }}
        >
          {a.scorecard.weighted.toFixed(1)}
        </div>
      </div>
      <div
        style={{
          color: "#86efac",
          fontSize: 12,
          marginTop: 10,
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {a.verdict.thesis.thesis}
      </div>
    </div>
  );
}

function HoldingRow({
  analysis,
  rank,
  onClick,
}: {
  analysis: FullAnalysis;
  rank: number;
  onClick: () => void;
}) {
  const a = analysis;
  const tier = scoreTier(a.scorecard.weighted);
  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 130px 70px 60px 20px",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #1a1a26",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#1a1a26")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <span style={{ color: "#4b5563", fontSize: 12 }}>{rank}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#e8e8f0", fontWeight: 700, fontSize: 14 }}>{a.ticker}</div>
        <div
          style={{
            color: "#6b7280",
            fontSize: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {a.company.name}
        </div>
      </div>

      {/* Category mini-bars */}
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28 }}>
        {a.scorecard.categories.map((c) => (
          <div
            key={c.key}
            title={`${c.label}: ${c.score.toFixed(1)}`}
            style={{
              flex: 1,
              height: `${(c.score / 10) * 100}%`,
              minHeight: 2,
              background:
                c.score >= 8 ? "#22c55e" : c.score >= 6 ? "#3b82f6" : c.score >= 4 ? "#f59e0b" : "#ef4444",
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      <div style={{ textAlign: "right" }}>
        <span style={{ color: tier.color, fontWeight: 800, fontSize: 16 }}>
          {a.scorecard.weighted.toFixed(1)}
        </span>
      </div>

      <span
        style={{
          color: tier.color,
          fontSize: 11,
          fontWeight: 700,
          textAlign: "right",
        }}
      >
        {tier.label}
      </span>

      <ArrowRight size={14} color="#4b5563" />
    </div>
  );
}

function EmptyState({
  onLoadDemo,
  onAnalyze,
}: {
  onLoadDemo: () => void;
  onAnalyze: () => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "80px 20px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: "#6366f120",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}
      >
        <LayoutGrid size={26} color="#818cf8" />
      </div>
      <h2 style={{ color: "#e8e8f0", fontWeight: 800, fontSize: 22, margin: "0 0 8px" }}>
        Your dashboard is empty
      </h2>
      <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
        Analyze stocks and they'll appear here ranked by the weighted investment
        framework. Or load sample data to explore the dashboard.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button
          onClick={onLoadDemo}
          style={{
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Sparkles size={15} /> Load Demo Data
        </button>
        <button
          onClick={onAnalyze}
          style={{
            background: "#111118",
            color: "#9ca3af",
            border: "1px solid #2a2a3a",
            borderRadius: 10,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Analyze a Stock
        </button>
      </div>
    </div>
  );
}
