import type { AppIcon } from "@/shared/icons";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../ui/utils";

type IconActionTone = "default" | "primary" | "danger";

type IconActionBaseProps = {
  /** Tooltip text and accessible name — required, the button has no visible label. */
  label: string;
  icon: AppIcon;
  tone?: IconActionTone;
  className?: string;
  /** Optional custom icon node (e.g. a spinner) rendered instead of `icon`. */
  children?: ReactNode;
};

type IconActionButtonProps = IconActionBaseProps &
  Omit<ComponentProps<"button">, "children"> & { to?: never };

type IconActionLinkProps = IconActionBaseProps & {
  /** Renders as an internal link instead of a button. */
  to: string;
  disabled?: boolean;
};

type IconActionProps = IconActionButtonProps | IconActionLinkProps;

const toneClass: Record<IconActionTone, string> = {
  default: "",
  primary: "icon-btn--primary",
  danger: "icon-btn--danger",
};

/**
 * Icon-only action with a tooltip: compact enough for card footers and table
 * rows, always accessible via `aria-label`.
 */
export function IconAction(props: IconActionProps) {
  const { label, icon: Icon, tone = "default", className, children } = props;
  const content = children ?? <Icon className="h-4 w-4" weight="regular" />;
  const classes = cn("icon-btn", toneClass[tone], className);

  const trigger =
    "to" in props && props.to != null ? (
      <Link
        to={props.to}
        aria-label={label}
        className={cn(classes, props.disabled && "pointer-events-none opacity-45")}
        aria-disabled={props.disabled || undefined}
      >
        {content}
      </Link>
    ) : (
      (() => {
        const {
          label: _l,
          icon: _i,
          tone: _t,
          className: _c,
          children: _ch,
          ...rest
        } = props as IconActionButtonProps;
        return (
          <button type="button" aria-label={label} className={classes} {...rest}>
            {content}
          </button>
        );
      })()
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
