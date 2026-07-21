import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAxiosError } from '@/lib/utils'

interface CrudApi<T> {
  list: (params: Record<string, unknown>) => Promise<{ data: { data: T[]; meta: { total: number; current_page: number; last_page: number } } }>
  create: (data: unknown) => Promise<unknown>
  update: (id: number, data: unknown) => Promise<unknown>
  delete: (id: number) => Promise<unknown>
}

interface Options {
  queryKey: string
  empresaId: number
}

export function useCrud<T>(api: CrudApi<T>, { queryKey, empresaId }: Options) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const query = useQuery({
    queryKey:    [queryKey, empresaId, page, search],
    queryFn:     () => api.list({ empresa_id: empresaId, page, search: search || undefined, per_page: 15 }).then((r) => r.data),
    enabled:     empresaId > 0,
    placeholderData: (prev) => prev,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] })

  const createMut = useMutation({
    mutationFn: api.create,
    onSuccess:  invalidate,
    onError:    (e) => setError(getAxiosError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => api.update(id, data),
    onSuccess:  invalidate,
    onError:    (e) => setError(getAxiosError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: api.delete,
    onSuccess:  invalidate,
    onError:    (e) => setError(getAxiosError(e)),
  })

  return {
    data:       query.data?.data ?? [],
    meta:       query.data?.meta ?? { total: 0, current_page: 1, last_page: 1 },
    loading:    query.isLoading,
    isError:    query.isError,
    refetch:    query.refetch,
    page,       setPage,
    search,     setSearch,
    error,      setError,
    create:     createMut,
    update:     updateMut,
    remove:     deleteMut,
  }
}
