import { useState, useMemo } from "react";
import type { TechnicalSummary } from "~/lib/analytics";
import type { AnalysisVerdict } from "~/lib/claude";
import { computeSizing, suggestStop, kellyFromTrade } from "~/lib/risk";
import { Calculator, Shield, Target, Percent, Activity } from "lucide-react";

interface Props {
  tech: TechnicalSummary;
  verdict: AnalysisVerdict;
}

export function RiskCalculator({ tech, verdict }: Props) {
  const atr = tech.atr14 || tech.current * 0.02;
  const defaultStop = suggestStop(tech.current, atr, 1.5, tech.support1);

  const [accountSize, setAccountSize] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(round2(tech.current));
  const [stop, setStop] = useState(round2(defaultStop.stop));
  const [target, setTarget] = useState(round2(verdict.target_6mo));

  const sizing = useMemo(
    () => computeSizing({ accountSize, riskPct, entry, stopPrice: stop, target }),
    [accountSize, riskPct, entry, stop, target]
  );
  const kelly = useMemo(
    () => kellyFromTrade(verdict.conviction, sizing.riskReward),
    [verdict.conviction, sizing.riskReward]
  );

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Calculator size={14} color="#22c55e" />
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          POSITION SIZING & RISK
        </span>
      </div>
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 16 }}>
        ATR(14) ${atr.toFixed(2)} · {tech.regime ?? "n/a"} · {tech.volRegime ?? "n/a"} vol · RSI{" "}
        {(tech.rsi14 ?? 50).toFixed(0)}
      </div>

      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Field label="Account size ($)" value={accountSize} onChange={setAccountSize} step={1000} />
        <Field label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} step={0.25} />
        <Field label="Entry ($)" value={entry} onChange={setEntry} step={0.5} />
        <Field
          label="Stop ($)"
          value={stop}
          onChange={setStop}
          step={0.5}
          hint={defaultStop.basis}
        />
        <Field label="Target ($)" value={target} onChange={setTarget} step={0.5} />
      </div>

      {/* Outputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
        <Out
          icon={<Activity size={12} color="#6366f1" />}
          label="Shares"
          value={sizing.shares.toLocaleString()}
          sub={`$${sizing.positionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${sizing.positionPctOfAccount.toFixed(0)}%)`}
          color="#e8e8f0"
        />
        <Out
          icon={<Shield size={12} color="#ef4444" />}
          label="$ at risk"
          value={`$${sizing.riskAmount.toFixed(0)}`}
          sub={`stop ${sizing.stopPctOfEntry.toFixed(1)}% away`}
          color="#ef4444"
        />
        <Out
          icon={<Target size={12} color="#22c55e" />}
          label="Risk / Reward"
          value={`1 : ${sizing.riskReward.toFixed(1)}`}
          sub={sizing.riskReward >= 2 ? "✓ meets 1:2" : "below 1:2"}
          color={sizing.riskReward >= 2 ? "#22c55e" : "#f59e0b"}
        />
      </div>

      {/* Sizing warning */}
      {sizing.warning && (
        <div
          style={{
            background: "#f59e0b12",
            border: "1px solid #f59e0b33",
            borderRadius: 8,
            padding: "9px 12px",
            color: "#f59e0b",
            fontSize: 12,
            marginBottom: 10,
          }}
        >
          ⚠ {sizing.warning}
        </div>
      )}

      {/* Kelly */}
      <div
        style={{
          background: "#1a1a26",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Percent size={12} color="#a78bfa" />
          <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>
            KELLY CRITERION (from conviction {verdict.conviction}/10)
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          <KellyStat label="Implied win prob" value={`${(kelly.winProb * 100).toFixed(0)}%`} />
          <KellyStat label="Full Kelly" value={`${(kelly.fullKelly * 100).toFixed(0)}%`} />
          <KellyStat
            label="Half-Kelly (rec.)"
            value={`${(kelly.halfKelly * 100).toFixed(0)}%`}
            highlight
          />
          <KellyStat
            label="Half-Kelly $"
            value={`$${(accountSize * kelly.halfKelly).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
        </div>
        <div style={{ color: "#6b7280", fontSize: 11, lineHeight: 1.5 }}>{kelly.note}</div>
      </div>

      <div style={{ color: "#4b5563", fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        Sizing uses the 1% rule against your stop. Kelly assumes a fixed edge from conviction —
        treat as an upper bound, not a guarantee. Verify all figures before trading.
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  hint?: string;
}) {
  return (
    <div>
      <label style={{ color: "#6b7280", fontSize: 10, display: "block", marginBottom: 4 }}>
        {label}
        {hint && <span style={{ color: "#4b5563" }}> · {hint}</span>}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: "100%",
          background: "#0a0a0f",
          border: "1px solid #2a2a3a",
          borderRadius: 8,
          padding: "8px 10px",
          color: "#e8e8f0",
          fontSize: 13,
          fontWeight: 600,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function Out({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div style={{ background: "#1a1a26", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
        {icon}
        <span style={{ color: "#6b7280", fontSize: 10 }}>{label}</span>
      </div>
      <div style={{ color, fontSize: 17, fontWeight: 800 }}>{value}</div>
      <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function KellyStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div style={{ color: highlight ? "#a78bfa" : "#9ca3af", fontSize: 15, fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ color: "#6b7280", fontSize: 10 }}>{label}</div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
