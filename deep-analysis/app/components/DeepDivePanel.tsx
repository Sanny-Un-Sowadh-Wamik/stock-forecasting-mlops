import type { DeepDive, SentimentAxes } from "~/lib/deepdive";
import {
  Scale,
  Swords,
  Gauge,
  Flame,
  AlertTriangle,
  CalendarClock,
  Zap,
  Users,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Props {
  deepDive: DeepDive;
}

export function DeepDivePanel({ deepDive: dd }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Committee dd={dd} />
      <SentimentMatrix dd={dd} />
      <Catalysts dd={dd} />
      <Scenarios dd={dd} />
      {dd.runAt && (
        <div style={{ color: "#4b5563", fontSize: 10, textAlign: "right" }}>
          Deep Dive generated {new Date(dd.runAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

/* ---------- Investment Committee ---------- */
function Committee({ dd }: { dd: DeepDive }) {
  const c = dd.committee;
  const conv = c.conviction;
  const convColor = conv >= 7 ? "#22c55e" : conv >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #6366f133",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Scale size={15} color="#818cf8" />
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          INVESTMENT COMMITTEE — BULL vs RED-TEAM DEBATE
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <DebateColumn
          title="BULL CASE"
          icon={<TrendingUp size={12} color="#22c55e" />}
          points={c.bullPoints}
          color="#22c55e"
        />
        <DebateColumn
          title="RED TEAM (BEAR)"
          icon={<Swords size={12} color="#ef4444" />}
          points={c.bearPoints}
          color="#ef4444"
        />
      </div>

      {/* Chair verdict + conviction */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          background: "#1a1a26",
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ color: convColor, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
            {conv}
          </div>
          <div style={{ color: "#6b7280", fontSize: 10 }}>conviction</div>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "#2a2a3a" }} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "#818cf8",
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            <Gauge size={11} /> CHAIR VERDICT
          </div>
          <div style={{ color: "#e8e8f0", fontSize: 12, lineHeight: 1.5 }}>{c.chairVerdict}</div>
        </div>
      </div>

      {/* Swing factor */}
      {c.swingFactor && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "#f59e0b0c",
            border: "1px solid #f59e0b22",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <Zap size={13} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700 }}>
              WHAT WOULD CHANGE MY MIND:{" "}
            </span>
            <span style={{ color: "#d1d5db", fontSize: 12 }}>{c.swingFactor}</span>
          </div>
        </div>
      )}

      {/* Crowd cross-reference */}
      {dd.crowdCrossRef && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "#a78bfa0c",
            border: "1px solid #a78bfa22",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <Users size={13} color="#a78bfa" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <span style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700 }}>
              CROWD CROSS-REFERENCE:{" "}
            </span>
            <span style={{ color: "#d1d5db", fontSize: 12 }}>{dd.crowdCrossRef}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DebateColumn({
  title,
  icon,
  points,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  points: string[];
  color: string;
}) {
  return (
    <div
      style={{
        background: color + "0a",
        border: `1px solid ${color}22`,
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color,
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {icon} {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        {points.map((p, i) => (
          <li key={i} style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.5 }}>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Multi-axis Sentiment (Sentiment 2.0) ---------- */
function SentimentMatrix({ dd }: { dd: DeepDive }) {
  const s = dd.sentiment;
  const axes: { key: keyof SentimentAxes; label: string; lowLabel: string; highLabel: string }[] = [
    { key: "optimism", label: "Optimism", lowLabel: "Pessimism", highLabel: "Optimism" },
    { key: "fear", label: "Confidence", lowLabel: "Fear", highLabel: "Confidence" },
    { key: "certainty", label: "Certainty", lowLabel: "Uncertain", highLabel: "Certain" },
    { key: "greed", label: "Greed", lowLabel: "Caution", highLabel: "Greed" },
  ];
  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Flame size={14} color="#f59e0b" />
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          MULTI-AXIS SENTIMENT
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {axes.map((a) => (
          <AxisBar
            key={a.key}
            label={a.label}
            lowLabel={a.lowLabel}
            highLabel={a.highLabel}
            value={s.axes[a.key]}
          />
        ))}
      </div>

      {/* Breadth */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Breadth label="Bullish" pct={s.bullishPct} color="#22c55e" />
        <Breadth label="Bearish" pct={s.bearishPct} color="#ef4444" />
      </div>

      {/* Consensus flag */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          background: "#1a1a26",
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <AlertTriangle size={13} color="#f59e0b" style={{ marginTop: 1, flexShrink: 0 }} />
        <span style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5 }}>{s.consensusFlag}</span>
      </div>
    </div>
  );
}

function AxisBar({
  label,
  lowLabel,
  highLabel,
  value,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number;
}) {
  // value -2..+2 → 0..100, 50 = center
  const pct = ((value + 2) / 4) * 100;
  const color = value > 0.3 ? "#22c55e" : value < -0.3 ? "#ef4444" : "#f59e0b";
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        <span>{lowLabel}</span>
        <span style={{ color, fontWeight: 700 }}>
          {value > 0 ? "+" : ""}
          {value.toFixed(1)}
        </span>
        <span>{highLabel}</span>
      </div>
      <div
        style={{
          position: "relative",
          background: "#1a1a26",
          borderRadius: 4,
          height: 8,
        }}
      >
        {/* center line */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "#3a3a4a",
          }}
        />
        {/* marker */}
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 6px)`,
            top: -2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}

function Breadth({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ flex: 1, background: "#1a1a26", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#9ca3af", fontSize: 11 }}>{label}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ background: "#0d0d14", borderRadius: 3, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

/* ---------- Narrative + Catalysts + Red Flags ---------- */
function Catalysts({ dd }: { dd: DeepDive }) {
  const riskColor = (r: string) =>
    r === "high" ? "#ef4444" : r === "med" ? "#f59e0b" : "#22c55e";
  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CalendarClock size={14} color="#3b82f6" />
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          NARRATIVE & FORWARD CATALYSTS
        </span>
      </div>

      {dd.narrative && (
        <div
          style={{
            color: "#e8e8f0",
            fontSize: 13,
            lineHeight: 1.5,
            background: "#1a1a26",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
          }}
        >
          <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 700 }}>NARRATIVE: </span>
          {dd.narrative}
        </div>
      )}

      {/* Narrative timeline */}
      {dd.timeline.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#4b5563", fontSize: 10, fontWeight: 700, marginBottom: 8 }}>
            TIMELINE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {dd.timeline.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: 10, position: "relative", paddingBottom: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#6366f1",
                      flexShrink: 0,
                      marginTop: 3,
                    }}
                  />
                  {i < dd.timeline.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: "#2a2a3a", marginTop: 2 }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#818cf8", fontSize: 11, fontWeight: 600 }}>{ev.date}</span>
                  <span style={{ color: "#e8e8f0", fontSize: 12 }}> · {ev.event}</span>
                  <span style={{ color: "#6b7280", fontSize: 11 }}> → {ev.reaction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalyst calendar */}
      {dd.catalysts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {dd.catalysts.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "#1a1a26",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e8e8f0", fontSize: 12, fontWeight: 600 }}>{c.event}</div>
                <div style={{ color: "#6b7280", fontSize: 11 }}>
                  {c.date} · {c.surprise} · ~{c.magnitude}
                </div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  background: riskColor(c.sellNewsRisk) + "1c",
                  color: riskColor(c.sellNewsRisk),
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 5,
                  textAlign: "center",
                }}
              >
                SELL-NEWS
                <br />
                {c.sellNewsRisk.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Red flags */}
      {dd.redFlags.length > 0 && (
        <div
          style={{
            background: "#ef44440a",
            border: "1px solid #ef444422",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "#ef4444",
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            <AlertTriangle size={12} /> RED FLAGS / CONTRADICTIONS
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {dd.redFlags.map((f, i) => (
              <li key={i} style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.5 }}>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Black-swan scenarios ---------- */
function Scenarios({ dd }: { dd: DeepDive }) {
  if (!dd.scenarios.length) return null;
  const probColor = (p: string) => {
    const x = p.toLowerCase();
    return x.includes("high") ? "#ef4444" : x.includes("med") ? "#f59e0b" : "#22c55e";
  };
  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <AlertTriangle size={14} color="#f59e0b" />
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          BLACK-SWAN STRESS TEST
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {dd.scenarios.map((s, i) => (
          <div
            key={i}
            style={{
              background: "#1a1a26",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: "#e8e8f0", fontSize: 12, fontWeight: 700 }}>{s.name}</span>
              <span
                style={{
                  color: probColor(s.probability),
                  fontSize: 9,
                  fontWeight: 700,
                  background: probColor(s.probability) + "1c",
                  padding: "2px 7px",
                  borderRadius: 4,
                }}
              >
                {s.probability.toUpperCase()}
              </span>
            </div>
            <div style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
              {s.impact}
            </div>
            <div style={{ color: "#6b7280", fontSize: 11, lineHeight: 1.5 }}>
              <span style={{ color: "#22c55e", fontWeight: 600 }}>Resilience: </span>
              {s.resilience}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
