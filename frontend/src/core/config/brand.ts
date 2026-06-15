/**
 * ============================================================================
 *  BRANDING CONFIG  ·  change your logos and names here
 * ============================================================================
 *
 *  This is the single place to update the application's identity. Drop your
 *  image files into `frontend/public/branding/` and point the paths below at
 *  them, or keep the bundled SVG placeholders.
 *
 *  HOW TO CHANGE THE LOGOS
 *  -----------------------
 *  1. App / product mark (the small "eye" used in the header, footer, login):
 *       - Replace `frontend/public/branding/app-logo.svg`
 *         (or add app-logo.png and update `appLogo` below), OR
 *       - Set `useImageAppLogo: false` to fall back to the inline vector mark
 *         in `shared/components/layout/logo.tsx`.
 *
 *  2. Institution / school logo (shown next to the app mark on login + footer):
 *       - Replace `frontend/public/branding/institution-logo.svg`
 *         (or add institution-logo.png and update `institutionLogo` below).
 *
 *  3. Campus / school background (home page + signed-in workspace):
 *       - Replace `frontend/public/branding/school-campus.svg` with your photo, e.g.
 *         `school-campus.jpg` or `school-campus.webp`, then update `schoolCampusImage`.
 *       - Recommended size: 1920×1080 or larger, landscape orientation.
 *
 *  Paths are resolved from the web root, so a file at
 *  `frontend/public/branding/app-logo.svg` is referenced as
 *  `/branding/app-logo.svg`.
 */

export const brand = {
  /** Product name shown across the app. */
  appName: "Knowing Eye",
  /** Short tagline used under the product name. */
  tagline: "Web-Based Examination Platform",
  /** Institution that owns the deployment. */
  institutionName: "Legacy College of Compostela",
  institutionUnit: "Institute of Information Technology",

  /** App / product mark. */
  appLogo: "/branding/app-logo.svg",
  /** Set false to use the built-in vector mark instead of the image above. */
  useImageAppLogo: false,

  /** Institution / school logo placeholder. */
  institutionLogo: "/branding/institution-logo.svg",

  /**
   * Full-page campus background (home + workspace).
   * Swap the file under `frontend/public/branding/` and point here.
   */
  schoolCampusImage: "/branding/school-campus.svg",
} as const;

export type Brand = typeof brand;
