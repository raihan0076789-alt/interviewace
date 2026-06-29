export default function LogoIcon({ size = 40 }: { size?: number }) {
  const id = "logoGrad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="52" x2="52" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="0.45" stopColor="#2563EB" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* WiFi arcs — top right */}
      <path d="M35 15 C38 11 39 7 36 4"   stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M39 18 C44 12 45 5 40 2"   stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M43 21 C50 13 51 3 44 -1"  stroke="#06B6D4" strokeWidth="2.0" strokeLinecap="round" strokeOpacity="0.6" />

      {/* Chat-bubble circle */}
      <circle cx="23" cy="29" r="19" stroke={`url(#${id})`} strokeWidth="2.8" />

      {/* Bubble tail */}
      <path
        d="M10 44 L4 51 L17 47"
        stroke={`url(#${id})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Person — head */}
      <circle cx="23" cy="23" r="5.5" fill="white" />

      {/* Person — shoulders */}
      <path d="M12 39 C12 31 16.5 27 23 27 C29.5 27 34 31 34 39" fill="white" />

      {/* Tie */}
      <path d="M23 28.5 L21.2 34 L23 31.5 L24.8 34 Z" fill="#7C3AED" fillOpacity="0.85" />

      {/* Sparkle — top-right of person */}
      <path
        d="M33 17 L34.2 13.5 L35.4 17 L39 18.2 L35.4 19.4 L34.2 23 L33 19.4 L29.5 18.2 Z"
        fill="#06B6D4"
      />
    </svg>
  );
}