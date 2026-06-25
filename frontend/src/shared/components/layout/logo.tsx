import { brand } from "../../../core/config/brand";

/**
 * App / product mark - LCC-inspired palette: green dominant, white, subtle blue & yellow.
 */
export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  if (brand.useImageAppLogo) {
    return (
      <img
        src={brand.appLogo}
        alt={`${brand.appName} logo`}
        className={`object-contain ${className}`}
      />
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="50" cy="50" r="46" fill="#166534" />
      <circle cx="50" cy="50" r="38" fill="#f8fffa" />
      <path
        d="M50 28C32 28 18 42 10 50C18 58 32 72 50 72C68 72 82 58 90 50C82 42 68 28 50 28Z"
        fill="#166534"
        fillOpacity="0.12"
        stroke="#166534"
        strokeWidth="2"
      />
      <circle cx="50" cy="50" r="14" fill="#22c55e" stroke="#166534" strokeWidth="2" />
      <circle cx="50" cy="50" r="7" fill="#166534" />
      <circle cx="54" cy="46" r="2.5" fill="#f8fffa" />
      {/* Subtle LCC accent arcs */}
      <path
        d="M50 8 A42 42 0 0 1 78 22"
        stroke="#1d4ed8"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M78 78 A42 42 0 0 1 50 92"
        stroke="#eab308"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}

/**
 * Institution / school logo - LCC green & white with minimal blue/yellow accents.
 */
export function InstitutionLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <img
      src={brand.institutionLogo}
      alt={`${brand.institutionName} logo`}
      className={`object-contain ${className}`}
    />
  );
}
