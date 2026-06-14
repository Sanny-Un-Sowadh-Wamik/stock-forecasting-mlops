import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { FundamentalMetrics } from "~/lib/fundamentals";

interface Props {
  fundamentals: FundamentalMetrics;
}

function fmtB(n: number | null): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
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
      <div style={{ color: "#6b7280", marginBottom: 4 }}>FY {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {fmtB(p.value)}
        </div>
      ))}
    </div>
  );
}

export function FinancialsPanel({ fundamentals }: Props) {
  const data = fundamentals.years.map((y) => ({
    year: y.year,
    Revenue: y.revenue ?? 0,
    "Net Income": y.netIncome ?? 0,
    "Operating CF": y.operatingCashFlow ?? 0,
  }));

  const hasData = data.some((d) => d.Revenue !== 0);

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
        FINANCIALS — 5 YEAR TREND
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "#4b5563", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#4b5563", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtB(v)}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff06" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Net Income" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Operating CF" fill="#818cf8" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          Financial statement data unavailable for this ticker.
        </div>
      )}

      {/* Growth + margin chips */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginTop: 16,
        }}
      >
        <Metric
          label="Revenue CAGR"
          value={fundamentals.revenueCagr != null ? `${fundamentals.revenueCagr.toFixed(1)}%` : "N/A"}
          good={fundamentals.revenueCagr != null && fundamentals.revenueCagr >= 10}
        />
        <Metric
          label="Profit CAGR"
          value={fundamentals.netIncomeCagr != null ? `${fundamentals.netIncomeCagr.toFixed(1)}%` : "N/A"}
          good={fundamentals.netIncomeCagr != null && fundamentals.netIncomeCagr >= 10}
        />
        <Metric
          label="Net Margin"
          value={fundamentals.netMargin != null ? `${fundamentals.netMargin.toFixed(1)}%` : "N/A"}
          good={fundamentals.netMargin != null && fundamentals.netMargin >= 10}
        />
      </div>

      {/* Health metrics table */}
      <div
        style={{
          marginTop: 14,
          background: "#0d0d14",
          borderRadius: 10,
          padding: "4px 14px",
        }}
      >
        <HealthRow
          label="Debt-to-Equity"
          value={fundamentals.debtToEquity != null ? `${fundamentals.debtToEquity.toFixed(2)}×` : "N/A"}
          good={fundamentals.debtToEquity != null ? fundamentals.debtToEquity < 1.5 : null}
          hint="Low is better"
        />
        <HealthRow
          label="Current Ratio"
          value={fundamentals.currentRatio != null ? fundamentals.currentRatio.toFixed(2) : "N/A"}
          good={fundamentals.currentRatio != null ? fundamentals.currentRatio > 1 : null}
          hint=">1 healthy"
        />
        <HealthRow
          label="Free Cash Flow"
          value={
            fundamentals.positiveCashFlow == null
              ? "N/A"
              : fundamentals.positiveCashFlow
                ? fundamentals.cashFlowGrowing
                  ? "Positive & growing"
                  : "Positive"
                : "Negative"
          }
          good={fundamentals.positiveCashFlow}
          hint="Positive preferred"
        />
        <HealthRow
          label="P/E (GAAP) · PEG"
          value={`${fundamentals.pe != null ? fundamentals.pe.toFixed(1) + "×" : "N/M"} · ${fundamentals.peg != null ? fundamentals.peg.toFixed(2) : "N/M"}`}
          good={fundamentals.peg != null ? fundamentals.peg < 1.5 : null}
          hint="PEG <1.5 fair"
          last
        />
      </div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  const color = good ? "#22c55e" : "#9ca3af";
  return (
    <div
      style={{
        background: "#1a1a26",
        borderRadius: 8,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ color, fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  good,
  hint,
  last,
}: {
  label: string;
  value: string;
  good: boolean | null;
  hint: string;
  last?: boolean;
}) {
  const color = good === true ? "#22c55e" : good === false ? "#ef4444" : "#9ca3af";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 0",
        borderBottom: last ? "none" : "1px solid #1a1a26",
      }}
    >
      <span style={{ color: "#9ca3af", fontSize: 12 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "#4b5563", fontSize: 10 }}>{hint}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700, minWidth: 90, textAlign: "right" }}>
          {value}
        </span>
      </div>
    </div>
  );
}
