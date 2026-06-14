import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TechnicalSummary } from "~/lib/analytics";
import type { AnalysisVerdict } from "~/lib/claude";

interface Props {
  tech: TechnicalSummary;
  verdict?: AnalysisVerdict;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1a1a26",
        border: "1px solid #2a2a3a",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ color: "#e8e8f0", fontWeight: 700 }}>
        ${payload[0].value.toFixed(2)}
      </div>
    </div>
  );
}

export function PriceChart({ tech, verdict }: Props) {
  const data = tech.monthlyCloses.map((m) => ({
    date: m.date.slice(0, 7), // YYYY-MM
    close: m.close,
  }));

  const min = Math.min(...data.map((d) => d.close)) * 0.95;
  const max = Math.max(...data.map((d) => d.close)) * 1.05;

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          PRICE HISTORY (24 months)
        </span>
        <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
          <LegendItem color="#ef4444" label={`2Y High $${tech.ath.toFixed(0)}`} />
          <LegendItem color="#22c55e" label={`2Y Low $${tech.atl.toFixed(0)}`} />
          {verdict && (
            <LegendItem
              color="#f59e0b"
              label={`Entry $${verdict.entry_zone.low.toFixed(0)}–$${verdict.entry_zone.high.toFixed(0)}`}
            />
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#4b5563", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fill: "#4b5563", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* ATH line */}
          <ReferenceLine
            y={tech.ath}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
          {/* ATL line */}
          <ReferenceLine
            y={tech.atl}
            stroke="#22c55e"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
          {/* Entry zone */}
          {verdict && (
            <>
              <ReferenceLine
                y={verdict.entry_zone.low}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={verdict.entry_zone.high}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            </>
          )}
          {/* Support */}
          <ReferenceLine
            y={tech.support1}
            stroke="#3b82f6"
            strokeDasharray="2 4"
            strokeOpacity={0.4}
          />

          <Area
            type="monotone"
            dataKey="close"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#818cf8" }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginTop: 12,
        }}
      >
        <StatChip
          label="from 2Y high"
          value={`${tech.pctFromAth.toFixed(1)}%`}
          color={tech.pctFromAth > -10 ? "#f59e0b" : "#ef4444"}
        />
        <StatChip
          label="from 2Y low"
          value={`+${tech.pctFromAtl.toFixed(1)}%`}
          color="#22c55e"
        />
        <StatChip
          label="3m momentum"
          value={`${tech.momentum3m >= 0 ? "+" : ""}${tech.momentum3m.toFixed(1)}%`}
          color={tech.momentum3m >= 0 ? "#22c55e" : "#ef4444"}
        />
        <StatChip
          label="volatility"
          value={`${tech.volatility.toFixed(1)}%`}
          color="#9ca3af"
        />
        <StatChip
          label="vol trend"
          value={tech.volumeTrend}
          color={
            tech.volumeTrend === "rising"
              ? "#22c55e"
              : tech.volumeTrend === "falling"
                ? "#ef4444"
                : "#9ca3af"
          }
        />
      </div>

      <div style={{ color: "#4b5563", fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
        Computed from ~24 months of price history{tech.asOf ? ` · price as of ${tech.asOf}` : ""}.
        High/low are 2-year, not all-time. These are platform estimates — verify exact figures
        against filings.
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#9ca3af" }}>
      <span
        style={{
          width: 20,
          height: 2,
          background: color,
          display: "inline-block",
          borderRadius: 1,
        }}
      />
      {label}
    </span>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#1a1a26",
        borderRadius: 6,
        padding: "6px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
