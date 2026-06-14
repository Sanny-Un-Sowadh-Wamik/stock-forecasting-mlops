import type { Scorecard as ScorecardType } from "~/lib/scoring";
import { scoreTier } from "~/lib/scoring";
import { Check, X, Minus } from "lucide-react";

interface Props {
  scorecard: ScorecardType;
}

function scoreColor(s: number): string {
  if (s >= 8) return "#22c55e";
  if (s >= 6.5) return "#3b82f6";
  if (s >= 5) return "#f59e0b";
  return "#ef4444";
}

export function Scorecard({ scorecard }: Props) {
  const tier = scoreTier(scorecard.weighted);
  const pct = (scorecard.weighted / 10) * 100;
  // Gauge arc
  const radius = 54;
  const circ = Math.PI * radius; // half circle
  const dash = (scorecard.weighted / 10) * circ;

  return (
    <div
      style={{
        background: "#111118",
        border: `1px solid ${tier.color}44`,
        borderRadius: 12,
        padding: 20,
        boxShadow: `0 0 24px ${tier.color}14`,
      }}
    >
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 18 }}>
        {/* Gauge */}
        <div style={{ position: "relative", width: 140, flexShrink: 0 }}>
          <svg width="140" height="84" viewBox="0 0 140 84">
            <path
              d="M 16 76 A 54 54 0 0 1 124 76"
              fill="none"
              stroke="#1e1e2e"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 16 76 A 54 54 0 0 1 124 76"
              fill="none"
              stroke={tier.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: 38,
              left: 0,
              right: 0,
              textAlign: "center",
            }}
          >
            <div style={{ color: tier.color, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
              {scorecard.weighted.toFixed(1)}
            </div>
            <div style={{ color: "#6b7280", fontSize: 10 }}>/ 10</div>
          </div>
        </div>

        {/* Verdict */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "inline-block",
              background: tier.color,
              color: "#000",
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 6,
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            {tier.label.toUpperCase()}
          </div>
          <div style={{ color: "#e8e8f0", fontSize: 13, lineHeight: 1.5 }}>
            {scorecard.isCandidate ? (
              <>
                Scores <strong style={{ color: "#22c55e" }}>8.0+</strong> across the
                weighted framework — qualifies as an investment candidate.
              </>
            ) : (
              <>
                Below the <strong>8.0</strong> candidate threshold. Track for entry or
                fundamental improvement.
              </>
            )}
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 6 }}>
            Checklist: {scorecard.checklistPassed}/{scorecard.checklistTotal} passed
          </div>
        </div>
      </div>

      {/* Category bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {scorecard.categories.map((c) => (
          <CategoryRow key={c.key} category={c} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
}: {
  category: ScorecardType["categories"][number];
}) {
  const color = scoreColor(category.score);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span style={{ color: "#e8e8f0", fontSize: 13, fontWeight: 600 }}>
          {category.label}
          <span style={{ color: "#4b5563", fontSize: 11, marginLeft: 6, fontWeight: 400 }}>
            {(category.weight * 100).toFixed(0)}%
          </span>
        </span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>
          {category.score.toFixed(1)}
        </span>
      </div>
      <div
        style={{
          background: "#1a1a26",
          borderRadius: 4,
          height: 7,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(category.score / 10) * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 4,
            transition: "width 0.7s ease",
          }}
        />
      </div>
      <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
        {category.rationale}
      </div>

      {/* Quant signal pills */}
      {category.detail && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {category.detail.signals.map((s, i) => (
            <SignalPill key={i} label={s.label} good={s.good} detail={s.detail} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalPill({
  label,
  good,
  detail,
}: {
  label: string;
  good: boolean | null;
  detail: string;
}) {
  const color = good === true ? "#22c55e" : good === false ? "#ef4444" : "#6b7280";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: color + "12",
        border: `1px solid ${color}28`,
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 10,
      }}
    >
      {good === true ? (
        <Check size={9} color={color} />
      ) : good === false ? (
        <X size={9} color={color} />
      ) : (
        <Minus size={9} color={color} />
      )}
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{detail}</span>
    </div>
  );
}
