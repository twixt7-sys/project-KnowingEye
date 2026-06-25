interface PostureSilhouetteProps {
  aligned?: boolean;
  className?: string;
}

/** Front-facing figure guide — head, neck, shoulders, torso, upper arms. */
export function PostureSilhouette({ aligned = false, className = "" }: PostureSilhouetteProps) {
  const stroke = aligned ? "rgba(52,211,153,0.38)" : "rgba(255,255,255,0.22)";
  const fill = aligned ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.025)";

  return (
    <svg
      viewBox="0 0 120 200"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      {/* Head */}
      <ellipse cx="60" cy="34" rx="19" ry="22" fill={fill} stroke={stroke} strokeWidth="0.65" />
      {/* Neck */}
      <path
        d="M 52 54 L 52 62 L 68 62 L 68 54 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.55"
        strokeLinejoin="round"
      />
      {/* Torso + shoulders */}
      <path
        d="M 52 62
           C 38 64, 26 72, 22 84
           C 18 96, 20 108, 24 118
           L 28 148
           C 30 158, 38 164, 48 166
           L 72 166
           C 82 164, 90 158, 92 148
           L 96 118
           C 100 108, 102 96, 98 84
           C 94 72, 82 64, 68 62
           Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
      {/* Left upper arm */}
      <path
        d="M 22 84
           C 12 88, 8 98, 10 110
           C 12 122, 18 128, 24 126"
        fill="none"
        stroke={stroke}
        strokeWidth="0.6"
        strokeLinecap="round"
      />
      {/* Right upper arm */}
      <path
        d="M 98 84
           C 108 88, 112 98, 110 110
           C 108 122, 102 128, 96 126"
        fill="none"
        stroke={stroke}
        strokeWidth="0.6"
        strokeLinecap="round"
      />
      {/* Center guide line (very subtle) */}
      <line
        x1="60"
        y1="12"
        x2="60"
        y2="172"
        stroke={stroke}
        strokeWidth="0.35"
        strokeDasharray="2 3"
        opacity="0.45"
      />
    </svg>
  );
}
