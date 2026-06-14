import type { Scorecard } from "~/lib/scoring";
import type { AnalysisVerdict } from "~/lib/claude";
import { Check, X, Quote, AlertTriangle, ShieldAlert, Compass } from "lucide-react";

interface Props {
  scorecard: Scorecard;
  verdict: AnalysisVerdict;
}

export function ChecklistCard({ scorecard, verdict }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Thesis */}
      <div
        style={{
          background: "#111118",
          border: "1px solid #6366f133",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#818cf8",
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          <Quote size={14} /> INVESTMENT THESIS
        </div>
        <p
          style={{
            color: "#e8e8f0",
            fontSize: 15,
            lineHeight: 1.6,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          “{verdict.thesis.thesis}”
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 16,
          }}
        >
          <RiskBox
            icon={<ShieldAlert size={13} color="#f59e0b" />}
            label="Biggest Risk"
            text={verdict.thesis.biggest_risk}
            color="#f59e0b"
          />
          <RiskBox
            icon={<AlertTriangle size={13} color="#ef4444" />}
            label="Worst Case"
            text={verdict.thesis.worst_case}
            color="#ef4444"
          />
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "#1a1a26",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <Compass size={13} color="#3b82f6" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
              INDUSTRY OUTLOOK
            </div>
            <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5 }}>
              {verdict.industry_outlook}
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
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
            marginBottom: 14,
          }}
        >
          <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
            INVESTMENT CHECKLIST
          </span>
          <span
            style={{
              color: scorecard.checklistPassed >= 7 ? "#22c55e" : "#f59e0b",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {scorecard.checklistPassed}/{scorecard.checklistTotal}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {scorecard.checklist.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: item.passed ? "#22c55e0c" : "#ef44440a",
                border: `1px solid ${item.passed ? "#22c55e22" : "#ef444418"}`,
                borderRadius: 8,
                padding: "9px 12px",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: item.passed ? "#22c55e" : "#ef444433",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.passed ? (
                  <Check size={11} color="#000" strokeWidth={3} />
                ) : (
                  <X size={11} color="#ef4444" strokeWidth={3} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e8e8f0", fontSize: 12, fontWeight: 500 }}>
                  {item.label}
                </div>
                <div style={{ color: "#6b7280", fontSize: 10 }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskBox({
  icon,
  label,
  text,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: color + "0c",
        border: `1px solid ${color}22`,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color,
          fontSize: 10,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {icon} {label.toUpperCase()}
      </div>
      <div style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}
