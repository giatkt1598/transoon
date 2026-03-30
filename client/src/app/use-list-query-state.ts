import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SortDirection } from './linq'

type UseListQueryStateOptions<TSortColumn extends string> = {
  defaultSortColumn: TSortColumn
  defaultSortDirection: SortDirection
  defaultRowsPerPage?: number
}

export function useListQueryState<TSortColumn extends string>({
  defaultSortColumn,
  defaultSortDirection,
  defaultRowsPerPage = 10,
}: UseListQueryStateOptions<TSortColumn>) {
  const [searchParams, setSearchParams] = useSearchParams()

  const searchTerm = searchParams.get('search') ?? ''
  const sortColumn =
    (searchParams.get('sort') as TSortColumn | null) ?? defaultSortColumn
  const sortDirection =
    (searchParams.get('dir') as SortDirection | null) ?? defaultSortDirection
  const page = Math.max(0, Number.parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const rowsPerPage = Math.max(
    1,
    Number.parseInt(searchParams.get('rows') ?? String(defaultRowsPerPage), 10) ||
      defaultRowsPerPage,
  )

  const sortState = useMemo(
    () => ({
      column: sortColumn,
      direction: sortDirection,
    }),
    [sortColumn, sortDirection],
  )

  const updateQueryParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextSearchParams = new URLSearchParams(searchParams)

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          nextSearchParams.delete(key)
          return
        }

        nextSearchParams.set(key, value)
      })

      setSearchParams(nextSearchParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const setSearchTerm = useCallback(
    (value: string) => {
      updateQueryParams({
        search: value.trim() ? value : null,
        page: '0',
      })
    },
    [updateQueryParams],
  )

  const setSortState = useCallback(
    (
      nextSortState: {
        column: TSortColumn
        direction: SortDirection
      } | null,
    ) => {
      updateQueryParams({
        sort: nextSortState?.column ?? null,
        dir: nextSortState?.direction ?? null,
        page: '0',
      })
    },
    [updateQueryParams],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      updateQueryParams({
        page: String(Math.max(0, nextPage)),
      })
    },
    [updateQueryParams],
  )

  const setRowsPerPage = useCallback(
    (nextRowsPerPage: number) => {
      updateQueryParams({
        rows: String(nextRowsPerPage),
        page: '0',
      })
    },
    [updateQueryParams],
  )

  return {
    searchTerm,
    setSearchTerm,
    sortState,
    setSortState,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
  }
}
