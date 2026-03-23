export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer eye shape */}
      <path
        d="M50 25C30 25 15 40 5 50C15 60 30 75 50 75C70 75 85 60 95 50C85 40 70 25 50 25Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Iris */}
      <circle
        cx="50"
        cy="50"
        r="15"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Pupil */}
      <circle cx="50" cy="50" r="8" fill="currentColor" />
      {/* Highlight */}
      <circle cx="55" cy="45" r="3" fill="white" fillOpacity="0.8" />
    </svg>
  );
}
