import type { PolySnapshot, PolyMarket } from "~/lib/polymarket";
import { TrendingUp, TrendingDown, ExternalLink, Users, Minus } from "lucide-react";

interface Props {
  snapshot?: PolySnapshot;
}

function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function PolymarketPanel({ snapshot }: Props) {
  const direct = snapshot?.direct ?? [];
  const macro = snapshot?.macro ?? [];
  const empty = direct.length === 0 && macro.length === 0;

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
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Users size={14} color="#a78bfa" />
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
          PREDICTION MARKETS — REAL-MONEY CROWD ODDS
        </span>
      </div>
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 16, lineHeight: 1.5 }}>
        Polymarket bettors with skin in the game. Cross-reference against news sentiment —
        divergence is a signal.
      </div>

      {empty ? (
        <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
          No relevant prediction markets found for this ticker.
        </div>
      ) : (
        <>
          {direct.length > 0 && (
            <Group label="DIRECT — markets naming this stock" markets={direct} />
          )}
          {macro.length > 0 && (
            <Group label="MACRO BACKDROP — moves all equities" markets={macro} dim />
          )}
        </>
      )}
    </div>
  );
}

function Group({
  label,
  markets,
  dim,
}: {
  label: string;
  markets: PolyMarket[];
  dim?: boolean;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          color: "#4b5563",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          margin: "10px 0 8px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {markets.map((m, i) => (
          <MarketRow key={i} market={m} dim={dim} />
        ))}
      </div>
    </div>
  );
}

function MarketRow({ market, dim }: { market: PolyMarket; dim?: boolean }) {
  const top = market.topOutcome;
  const prob = top ? top.prob : 0;
  const pct = Math.round(prob * 100);
  // Color the headline outcome: Yes/positive leaning green, No/negative red, else neutral
  const name = (top?.name ?? "").toLowerCase();
  const color =
    name === "yes"
      ? "#22c55e"
      : name === "no"
        ? "#ef4444"
        : "#a78bfa";

  const mom = market.weekChange;
  const momColor = mom > 0.005 ? "#22c55e" : mom < -0.005 ? "#ef4444" : "#6b7280";

  return (
    <div
      style={{
        background: "#1a1a26",
        borderRadius: 8,
        padding: "10px 12px",
        opacity: dim ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <a
          href={market.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#e8e8f0",
            fontSize: 12,
            lineHeight: 1.4,
            textDecoration: "none",
            display: "flex",
            alignItems: "flex-start",
            gap: 5,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {market.question}
          </span>
          <ExternalLink size={10} color="#4b5563" style={{ flexShrink: 0, marginTop: 2 }} />
        </a>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
          <div style={{ color: "#6b7280", fontSize: 10 }}>{top?.name ?? ""}</div>
        </div>
      </div>

      {/* prob bar */}
      <div
        style={{
          background: "#0d0d14",
          borderRadius: 3,
          height: 5,
          overflow: "hidden",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            color: momColor,
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {mom > 0.005 ? (
            <TrendingUp size={10} />
          ) : mom < -0.005 ? (
            <TrendingDown size={10} />
          ) : (
            <Minus size={10} />
          )}
          {Math.abs(mom) > 0.005
            ? `${mom > 0 ? "+" : "−"}${Math.abs(mom * 100).toFixed(0)}pt this week`
            : "flat this week"}
        </span>
        <span style={{ color: "#6b7280", fontSize: 10 }}>{fmtVol(market.volume)} vol</span>
      </div>
    </div>
  );
}
