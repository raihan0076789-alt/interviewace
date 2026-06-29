interface ScoreBadgeProps {
  score: number | null;
  label?: string;
  size?: "sm" | "md" | "lg";
}

function getStyle(score: number | null): { bg: string; border: string; text: string; glow: string } {
  if (score === null) return {
    bg: "rgba(5,30,27,0.6)", border: "rgba(16,185,129,0.15)",
    text: "rgba(110,231,183,0.4)", glow: "none",
  };
  if (score >= 8) return {
    bg: "rgba(5,50,35,0.7)", border: "rgba(16,185,129,0.4)",
    text: "#34D399", glow: "0 0 12px rgba(16,185,129,0.3)",
  };
  if (score >= 6) return {
    bg: "rgba(30,25,5,0.7)", border: "rgba(234,179,8,0.35)",
    text: "#FCD34D", glow: "0 0 12px rgba(234,179,8,0.2)",
  };
  return {
    bg: "rgba(40,8,8,0.7)", border: "rgba(239,68,68,0.35)",
    text: "#F87171", glow: "0 0 12px rgba(239,68,68,0.2)",
  };
}

function getQualityLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 8) return "Strong";
  if (score >= 6) return "Good";
  return "Needs Work";
}

export default function ScoreBadge({ score, label, size = "md" }: ScoreBadgeProps) {
  const style = getStyle(score);
  const numSize = size === "lg" ? "2.5rem" : size === "sm" ? "1rem" : "1.75rem";
  const fontSize = size === "lg" ? "2.25rem" : size === "sm" ? "0.875rem" : "1.5rem";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: "0.75rem",
      padding: size === "sm" ? "0.375rem 0.75rem" : "0.625rem 1rem",
      boxShadow: style.glow,
      minWidth: numSize,
      backdropFilter: "blur(8px)",
    }}>
      <span style={{ fontSize, fontWeight: 700, color: style.text, lineHeight: 1 }}>
        {score !== null ? score.toFixed(1) : "—"}
      </span>
      <span style={{ fontSize: "0.65rem", color: style.text, opacity: 0.75, marginTop: "0.2rem" }}>
        {label ?? getQualityLabel(score)}
      </span>
    </div>
  );
}