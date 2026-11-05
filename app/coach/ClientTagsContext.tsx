'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ClientTag = { id: string; name: string; color: string }

type ClientTagsState = {
  allTags: ClientTag[]
  byClient: Record<string, ClientTag[]>
  loading: boolean
  refresh: () => Promise<void>
  createTag: (name: string, color: string) => Promise<ClientTag | null>
  renameTag: (tagId: string, name: string, color: string) => Promise<boolean>
  deleteTag: (tagId: string) => Promise<boolean>
  assignTag: (clientId: string, tagId: string) => Promise<boolean>
  unassignTag: (clientId: string, tagId: string) => Promise<boolean>
}

const ClientTagsContext = createContext<ClientTagsState | null>(null)

const FALLBACK: ClientTagsState = {
  allTags: [],
  byClient: {},
  loading: false,
  refresh: async () => {},
  createTag: async () => null,
  renameTag: async () => false,
  deleteTag: async () => false,
  assignTag: async () => false,
  unassignTag: async () => false,
}

export function ClientTagsProvider({ children }: { children: React.ReactNode }) {
  const [allTags, setAllTags] = useState<ClientTag[]>([])
  const [byClient, setByClient] = useState<Record<string, ClientTag[]>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/coach/client-tags')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setAllTags(data.allTags ?? [])
    setByClient(data.byClient ?? {})
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createTag = useCallback(async (name: string, color: string) => {
    const res = await fetch('/api/coach/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) return null
    const tag = await res.json() as ClientTag
    setAllTags((prev) => [...prev, tag])
    return tag
  }, [])

  const renameTag = useCallback(async (tagId: string, name: string, color: string) => {
    const res = await fetch(`/api/coach/tags/${tagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) return false
    setAllTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, name, color } : t)))
    setByClient((prev) => {
      const next: Record<string, ClientTag[]> = {}
      for (const [cid, tags] of Object.entries(prev)) next[cid] = tags.map((t) => (t.id === tagId ? { ...t, name, color } : t))
      return next
    })
    return true
  }, [])

  const deleteTag = useCallback(async (tagId: string) => {
    const res = await fetch(`/api/coach/tags/${tagId}`, { method: 'DELETE' })
    if (!res.ok) return false
    setAllTags((prev) => prev.filter((t) => t.id !== tagId))
    setByClient((prev) => {
      const next: Record<string, ClientTag[]> = {}
      for (const [cid, tags] of Object.entries(prev)) next[cid] = tags.filter((t) => t.id !== tagId)
      return next
    })
    return true
  }, [])

  const assignTag = useCallback(async (clientId: string, tagId: string) => {
    const res = await fetch(`/api/coach/clients/${clientId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    })
    if (!res.ok) return false
    setByClient((prev) => {
      const tag = allTags.find((t) => t.id === tagId)
      if (!tag) return prev
      const existing = prev[clientId] ?? []
      if (existing.some((t) => t.id === tagId)) return prev
      return { ...prev, [clientId]: [...existing, tag] }
    })
    return true
  }, [allTags])

  const unassignTag = useCallback(async (clientId: string, tagId: string) => {
    const res = await fetch(`/api/coach/clients/${clientId}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    })
    if (!res.ok) return false
    setByClient((prev) => ({ ...prev, [clientId]: (prev[clientId] ?? []).filter((t) => t.id !== tagId) }))
    return true
  }, [])

  return (
    <ClientTagsContext.Provider value={{ allTags, byClient, loading, refresh, createTag, renameTag, deleteTag, assignTag, unassignTag }}>
      {children}
    </ClientTagsContext.Provider>
  )
}

export function useClientTags(): ClientTagsState {
  const ctx = useContext(ClientTagsContext)
  return ctx ?? FALLBACK
}
