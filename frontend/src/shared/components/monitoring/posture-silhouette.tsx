interface PostureSilhouetteProps {
  aligned?: boolean;
  className?: string;
}

/**
 * Posture guide outline shown over the webcam preview.
 *
 * This is a simple placeholder that renders the SVG asset at
 * `frontend/public/branding/posture-silhouette.svg`. Swap that file to change
 * the outline - no code changes required. `aligned` only tints/fades the asset
 * (green + fully visible when the examinee is correctly positioned).
 */
export function PostureSilhouette({ aligned = false, className = "" }: PostureSilhouetteProps) {
  return (
    <img
      src="/branding/posture-silhouette.svg"
      alt=""
      aria-hidden
      className={`object-contain ${aligned ? "opacity-60" : "opacity-30"} ${className}`}
    />
  );
}
