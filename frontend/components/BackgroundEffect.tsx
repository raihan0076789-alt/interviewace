export default function BackgroundEffect() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)" }} />

      {/* Glowing orbs */}
      <div className="absolute rounded-full animate-orb-float orb-1"
        style={{ width: 600, height: 600, top: "-10%", left: "-15%",
          background: "radial-gradient(circle, rgba(16,185,129,1) 0%, transparent 70%)",
          filter: "blur(80px)", opacity: 0.12 }} />

      <div className="absolute rounded-full animate-orb-float-r"
        style={{ width: 500, height: 500, bottom: "5%", right: "-10%",
          background: "radial-gradient(circle, rgba(20,184,166,1) 0%, transparent 70%)",
          filter: "blur(80px)", opacity: 0.10 }} />

      <div className="absolute rounded-full animate-orb-slow"
        style={{ width: 400, height: 400, top: "40%", left: "40%",
          background: "radial-gradient(circle, rgba(52,211,153,1) 0%, transparent 70%)",
          filter: "blur(90px)", opacity: 0.07 }} />

      <div className="absolute rounded-full animate-orb-float"
        style={{ width: 300, height: 300, top: "20%", right: "20%",
          background: "radial-gradient(circle, rgba(16,185,129,1) 0%, transparent 70%)",
          filter: "blur(70px)", opacity: 0.09,
          animationDelay: "4s" }} />

      {/* Subtle grid */}
      <div className="absolute inset-0" style={{
        backgroundImage:
          "linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />

      {/* Vignette overlay */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(4,27,26,0.7) 100%)" }} />

      {/* Top shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent)" }} />
    </div>
  );
}