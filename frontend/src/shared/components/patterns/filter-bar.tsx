import { Search } from "@/shared/icons";

import { cn } from "../ui/utils";

export type FilterChip = { value: string; label: string };
export type SortOption = { value: string; label: string };

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  className?: string;
}

/**
 * Reusable search + status/category chips + sort control.
 *
 * Directive Area 03 ("Exam discovery" - "don't rely on cards alone once
 * volume grows") calls for search/filter/sort, and Area 02 (dashboard
 * organization) explicitly overlaps it - the plan's own sequencing note
 * says to build the primitive once and reuse it, rather than each screen
 * growing its own inline search input and chip row.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  chips,
  activeChip,
  onChipChange,
  sortOptions,
  sortValue,
  onSortChange,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="form-field w-full py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => onChipChange?.(chip.value)}
              className={`filter-chip ${activeChip === chip.value ? "filter-chip--active" : ""}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {sortOptions && sortOptions.length > 0 && (
        <select
          value={sortValue}
          onChange={(e) => onSortChange?.(e.target.value)}
          className="form-field shrink-0 py-2 text-sm sm:w-auto"
          aria-label="Sort by"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
