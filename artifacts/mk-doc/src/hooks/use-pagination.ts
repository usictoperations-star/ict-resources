import { useEffect, useMemo, useState } from "react";

export function usePagination<T>(items: T[] | undefined, pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total]);

  const safePage = Math.min(page, totalPages);
  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  const pageItems = useMemo(
    () => (items ?? []).slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    startIndex,
    endIndex,
    total,
  };
}
