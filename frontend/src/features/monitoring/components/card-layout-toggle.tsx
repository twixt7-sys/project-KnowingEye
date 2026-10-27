import { CARD_LAYOUTS, type CardLayout, isCardLayout } from "@/features/monitoring/lib/card-layout";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";

type CardLayoutToggleProps = {
  value: CardLayout;
  onChange: (layout: CardLayout) => void;
};

/** Small / medium / large switch for the candidate tiles. */
export function CardLayoutToggle({ value, onChange }: CardLayoutToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label="Card size"
      className="shrink-0"
      value={value}
      // Radix reports "" when the active item is clicked again; keep the current size.
      onValueChange={(next) => isCardLayout(next) && onChange(next)}
    >
      {CARD_LAYOUTS.map(({ value: option, label, icon: Icon }) => (
        // ToggleGroupItem doesn't forward refs, so a Radix tooltip can't anchor to it.
        <ToggleGroupItem key={option} value={option} aria-label={label} title={label}>
          <Icon className="h-4 w-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
