import {
  motion,
  useReducedMotion as useFramerReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import type { ReactNode } from "react";

export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

type FadeInProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
};

export function FadeIn({
  children,
  delay = 0,
  className,
  ...props
}: FadeInProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.25,
        delay: reduced ? 0 : delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type SlideStepProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  stepKey: string | number;
  direction?: "forward" | "back";
};

export function SlideStep({
  children,
  stepKey,
  direction = "forward",
  className,
  ...props
}: SlideStepProps) {
  const reduced = useReducedMotion();
  const x = direction === "forward" ? 24 : -24;

  return (
    <motion.div
      key={stepKey}
      initial={reduced ? false : { opacity: 0, x }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? undefined : { opacity: 0, x: -x }}
      transition={{
        duration: reduced ? 0 : 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
