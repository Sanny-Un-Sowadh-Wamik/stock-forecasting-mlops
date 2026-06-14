import type { SentimentResult } from "~/lib/apify";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";

interface Props {
  sentiment: SentimentResult;
}

export function SentimentPanel({ sentiment }: Props) {
  const pct = Math.round(((sentiment.netScore + 1) / 2) * 100);
  const color =
    sentiment.netLabel === "bullish"
      ? "#22c55e"
      : sentiment.netLabel === "bearish"
        ? "#ef4444"
        : "#f59e0b";

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
        SENTIMENT ANALYSIS
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={{ color, fontWeight: 700, fontSize: 14, textTransform: "uppercase" }}>
            {sentiment.netLabel}
          </span>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>
            Score: <span style={{ color }}>{sentiment.netScore.toFixed(2)}</span>
          </span>
        </div>
        <div
          style={{
            background: "#1a1a26",
            borderRadius: 4,
            height: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${color}66, ${color})`,
              borderRadius: 4,
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          <span>Bear</span>
          <span>Neutral</span>
          <span>Bull</span>
        </div>
      </div>

      {/* Counts */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}
      >
        <CountBox
          label="Bullish"
          count={sentiment.bullCount}
          total={sentiment.articles.length}
          color="#22c55e"
        />
        <CountBox
          label="Neutral"
          count={
            sentiment.articles.length -
            sentiment.bullCount -
            sentiment.bearCount
          }
          total={sentiment.articles.length}
          color="#f59e0b"
        />
        <CountBox
          label="Bearish"
          count={sentiment.bearCount}
          total={sentiment.articles.length}
          color="#ef4444"
        />
      </div>

      {/* Market data row */}
      {(sentiment.peRatio || sentiment.shortRatio || sentiment.earningsDate) && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          {sentiment.peRatio && (
            <MarketChip label="P/E" value={`${sentiment.peRatio}×`} />
          )}
          {sentiment.shortRatio && (
            <MarketChip label="Short Ratio" value={`${sentiment.shortRatio}`} />
          )}
          {sentiment.earningsDate && (
            <MarketChip label="Earnings" value={sentiment.earningsDate} color="#818cf8" />
          )}
          {sentiment.livePrice && (
            <MarketChip label="Live Price" value={`$${sentiment.livePrice}`} color="#22c55e" />
          )}
        </div>
      )}

      {/* Articles */}
      <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
        TOP ARTICLES
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sentiment.articles.slice(0, 6).map((a, i) => (
          <ArticleRow key={i} article={a} />
        ))}
      </div>
    </div>
  );
}

function CountBox({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: color + "10",
        border: `1px solid ${color}25`,
        borderRadius: 8,
        padding: "10px",
        textAlign: "center",
      }}
    >
      <div style={{ color, fontWeight: 800, fontSize: 20 }}>{count}</div>
      <div style={{ color: "#9ca3af", fontSize: 10 }}>
        {label} / {total}
      </div>
    </div>
  );
}

function MarketChip({
  label,
  value,
  color = "#9ca3af",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#1a1a26",
        borderRadius: 6,
        padding: "5px 10px",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <span style={{ color: "#6b7280", fontSize: 10 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

interface ArticleRowProps {
  article: {
    title: string;
    url: string;
    source: string;
    sentimentLabel: "bullish" | "bearish" | "neutral";
    sentimentScore: number;
    publishedAt: string;
  };
}

function ArticleRow({ article }: ArticleRowProps) {
  const color =
    article.sentimentLabel === "bullish"
      ? "#22c55e"
      : article.sentimentLabel === "bearish"
        ? "#ef4444"
        : "#f59e0b";

  const icon =
    article.sentimentLabel === "bullish" ? (
      <TrendingUp size={12} color={color} />
    ) : article.sentimentLabel === "bearish" ? (
      <TrendingDown size={12} color={color} />
    ) : (
      <Minus size={12} color={color} />
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        background: "#1a1a26",
        borderRadius: 6,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#e8e8f0",
            fontSize: 12,
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {article.title}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
          <span style={{ color: "#6b7280", fontSize: 10 }}>{article.source}</span>
          {article.publishedAt && (
            <span style={{ color: "#4b5563", fontSize: 10 }}>
              {article.publishedAt.slice(0, 10)}
            </span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            color,
            fontSize: 11,
            fontWeight: 700,
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {article.sentimentScore >= 0 ? "+" : ""}
          {article.sentimentScore.toFixed(2)}
        </span>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#4b5563", display: "flex" }}
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
