import type { Section } from './types'

export type PageKind = 'cover' | 'detail' | 'profit'

/** 페이지에 실리는 섹션 조각 (섹션이 페이지를 넘어가면 쪼개진다) */
export interface PageSection {
  sectionId: string
  title: string
  /** 이 페이지에 표시할 아이템의 원본 인덱스 범위 */
  from: number
  to: number
  /** 섹션 소계 행을 이 페이지에 그릴지 (섹션의 첫 조각에만) */
  showHeader: boolean
  /** 이어지는 조각이면 제목에 (계속) 표기 */
  continued: boolean
}

export interface QuotePage {
  id: string
  kind: PageKind
  label: string
  /** 같은 종류 안에서의 페이지 번호 (1부터) */
  index: number
  totalOfKind: number
  sections: PageSection[]
  /** 마지막 페이지면 총합계 행을 그린다 */
  showGrandTotal: boolean
}

/**
 * A4 세로 1장에 들어가는 표 행 수 (섹션 헤더 행 포함).
 * 비고가 두 줄로 늘어나는 행을 감안해 여유를 두고 잡았다.
 */
export const ROWS_PER_PAGE = 38

function paginateSections(sections: Section[], kind: PageKind, rowsPerPage: number): QuotePage[] {
  const pages: QuotePage[] = []
  let current: PageSection[] = []
  let used = 0

  const flush = () => {
    if (current.length === 0) return
    pages.push({
      id: `${kind}-${pages.length + 1}`,
      kind,
      label: '',
      index: pages.length + 1,
      totalOfKind: 0,
      sections: current,
      showGrandTotal: false,
    })
    current = []
    used = 0
  }

  for (const sec of sections) {
    let i = 0
    let first = true
    // 아이템이 없는 섹션도 헤더 한 줄은 나온다
    if (sec.items.length === 0) {
      if (used + 1 > rowsPerPage) flush()
      current.push({ sectionId: sec.id, title: sec.title, from: 0, to: -1, showHeader: true, continued: false })
      used += 1
      continue
    }
    while (i < sec.items.length) {
      const headerCost = first ? 1 : 1 // 이어지는 조각도 제목 행을 하나 쓴다
      if (used + headerCost + 1 > rowsPerPage) flush()
      const room = rowsPerPage - used - headerCost
      const take = Math.min(room, sec.items.length - i)
      current.push({
        sectionId: sec.id,
        title: sec.title,
        from: i,
        to: i + take - 1,
        showHeader: first,
        continued: !first,
      })
      used += headerCost + take
      i += take
      first = false
      if (used >= rowsPerPage) flush()
    }
  }
  flush()

  if (pages.length === 0) {
    pages.push({
      id: `${kind}-1`,
      kind,
      label: '',
      index: 1,
      totalOfKind: 1,
      sections: [],
      showGrandTotal: true,
    })
  }

  // 총합계 행이 마지막 페이지에 안 들어가면 페이지를 하나 더 만든다
  const last = pages[pages.length - 1]
  const lastUsed = last.sections.reduce((a, s) => a + (s.to - s.from + 1) + 1, 0)
  if (lastUsed + 1 > rowsPerPage) {
    pages.push({
      id: `${kind}-${pages.length + 1}`,
      kind,
      label: '',
      index: pages.length + 1,
      totalOfKind: 0,
      sections: [],
      showGrandTotal: true,
    })
  } else {
    last.showGrandTotal = true
  }

  const total = pages.length
  return pages.map((p, i) => ({
    ...p,
    index: i + 1,
    totalOfKind: total,
    label: `${kind === 'detail' ? '상세내역' : '매출이익'} ${i + 1}/${total}`,
  }))
}

export function buildPages(sections: Section[], rowsPerPage = ROWS_PER_PAGE): QuotePage[] {
  const cover: QuotePage = {
    id: 'cover-1',
    kind: 'cover',
    label: '갑지 (표지)',
    index: 1,
    totalOfKind: 1,
    sections: [],
    showGrandTotal: false,
  }
  return [
    cover,
    ...paginateSections(sections, 'detail', rowsPerPage),
    ...paginateSections(sections, 'profit', rowsPerPage),
  ]
}
