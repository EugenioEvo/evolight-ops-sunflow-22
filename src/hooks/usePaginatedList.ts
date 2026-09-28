import { useEffect, useMemo, useState } from 'react';

/**
 * Client-side pagination for lists already filtered in memory.
 * Resets to page 1 whenever `resetKey` changes (e.g. search/filters).
 */
export function usePaginatedList<T>(items: T[], pageSize = 20, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => { setPage(1); }, [resetKey]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, totalPages, pageItems, totalItems: items.length, pageSize };
}
