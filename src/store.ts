import { useEffect, useState } from 'react'
import type { ProjectFile, QuoteDoc, Standards } from './types'
import { DEFAULT_INPUT, DEFAULT_STANDARDS } from './defaults'

const KEY_STD = 'youhost.quote.standards.v1'
const KEY_DOC = 'youhost.quote.doc.v1'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as T) }
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

export function resetStorage() {
  localStorage.removeItem(KEY_STD)
  localStorage.removeItem(KEY_DOC)
}
