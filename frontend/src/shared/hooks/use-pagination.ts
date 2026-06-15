import { useCallback, useState } from "react";

export function usePagination(initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const resetPage = useCallback(() => setPage(1), []);

  const setPageSizeAndReset = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize: setPageSizeAndReset,
    resetPage,
  };
}
