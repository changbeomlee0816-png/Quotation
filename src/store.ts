import { useEffect, useState } from 'react'
import type { ProjectFile, QuoteDoc, SavedQuote, Standards } from './types'
import { DEFAULT_INPUT, DEFAULT_STANDARDS } from './defaults'

const KEY_STD = 'youhost.quote.standards.v1'
const KEY_DOC = 'youhost.quote.doc.v1'

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    // 객체일 때만 기본값과 병합한다. 숫자·문자열 같은 값은 그대로 쓴다.
    if (isPlainObject(fallback) && isPlainObject(parsed)) return { ...fallback, ...parsed }
    return parsed
  } catch {
    return fallback
  }
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial))
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 저장 공간 초과 등은 무시 — 화면 동작에는 영향 없음 */
    }
  }, [key, value])
  return [value, setValue] as const
}

export const DEFAULT_DOC: QuoteDoc = { input: DEFAULT_INPUT, sections: [] }

export function useStandards() {
  return usePersistentState<Standards>(KEY_STD, DEFAULT_STANDARDS)
}

export function useDoc() {
  return usePersistentState<QuoteDoc>(KEY_DOC, DEFAULT_DOC)
}

export function exportProject(standards: Standards, doc: QuoteDoc, filename: string) {
  const file: ProjectFile = { version: 1, standards, doc }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importProject(file: File): Promise<ProjectFile> {
  const text = await file.text()
  const parsed = JSON.parse(text) as ProjectFile
  if (!parsed || parsed.version !== 1 || !parsed.standards || !parsed.doc) {
    throw new Error('지원하지 않는 파일 형식입니다.')
  }
  return {
    version: 1,
    standards: { ...DEFAULT_STANDARDS, ...parsed.standards },
    doc: { input: { ...DEFAULT_INPUT, ...parsed.doc.input }, sections: parsed.doc.sections ?? [] },
  }
}

/* ------------------------------------------------------------------ */
/* 견적 이력 — 여러 건을 저장해 두고 다시 열어 쓴다                        */
/* ------------------------------------------------------------------ */

const KEY_LIB = 'youhost.quote.library.v1'

export function loadLibrary(): SavedQuote[] {
  try {
    const raw = localStorage.getItem(KEY_LIB)
    const list = raw ? (JSON.parse(raw) as SavedQuote[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeLibrary(list: SavedQuote[]) {
  localStorage.setItem(KEY_LIB, JSON.stringify(list))
}

export function useLibrary() {
  const [list, setList] = useState<SavedQuote[]>(() => loadLibrary())

  const persist = (next: SavedQuote[]) => {
    const sorted = [...next].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    try {
      writeLibrary(sorted)
    } catch {
      alert('저장 공간이 부족합니다. 오래된 견적을 지워 주세요.')
      return
    }
    setList(sorted)
  }

  /** 같은 견적번호가 있으면 덮어쓰고, 없으면 새로 추가한다 */
  const save = (doc: QuoteDoc, total: number) => {
    const now = new Date().toISOString()
    const entry: SavedQuote = {
      id: doc.input.quoteNo || `q-${now}`,
      quoteNo: doc.input.quoteNo,
      customer: doc.input.customer,
      subject: doc.input.subject,
      date: doc.input.date,
      total,
      savedAt: now,
      doc: structuredClone(doc),
    }
    persist([entry, ...list.filter((q) => q.id !== entry.id)])
    return entry
  }

  const remove = (id: string) => persist(list.filter((q) => q.id !== id))
  const clear = () => persist([])

  return { list, save, remove, clear }
}

export function resetStorage() {
  localStorage.removeItem(KEY_LIB)
  localStorage.removeItem(KEY_STD)
  localStorage.removeItem(KEY_DOC)
}
