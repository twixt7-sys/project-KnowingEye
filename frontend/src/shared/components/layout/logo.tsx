import { brand } from "../../../core/config/brand";

/**
 * App / product mark.
 *
 * By default this renders the built-in vector "eye" (which follows the green
 * theme via `currentColor`). To use an image instead, set `useImageAppLogo: true`
 * in `core/config/brand.ts` and drop your file at the configured path.
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

/**
 * Institution / school logo placeholder.
 *
 * Swap the image by replacing `frontend/public/branding/institution-logo.svg`
 * or updating `institutionLogo` in `core/config/brand.ts`.
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
