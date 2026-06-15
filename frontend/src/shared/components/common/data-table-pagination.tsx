import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { cn } from "../ui/utils";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  loading?: boolean;
  className?: string;
};

function buildPageItems(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | "ellipsis")[] = [1];

  if (page > 3) items.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }

  if (page < totalPages - 2) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

export function DataTablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  loading = false,
  className,
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalCount);
  const items = buildPageItems(safePage, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        {loading
          ? "Loading…"
          : totalCount === 0
            ? "No rows"
            : `Showing ${start}–${end} of ${totalCount}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="form-field w-auto px-2 py-1 text-sm"
              disabled={loading}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (safePage > 1 && !loading) onPageChange(safePage - 1);
                }}
                className={cn(
                  safePage <= 1 || loading ? "pointer-events-none opacity-50" : ""
                )}
              />
            </PaginationItem>

            {items.map((item, idx) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === safePage}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!loading) onPageChange(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (safePage < totalPages && !loading) onPageChange(safePage + 1);
                }}
                className={cn(
                  safePage >= totalPages || loading ? "pointer-events-none opacity-50" : ""
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

export function getTotalPages(totalCount: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}
