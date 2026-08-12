import { useEffect, useMemo, useRef, useState } from 'react'
import type { LineItem, Section, Standards } from '../types'
import { emptyItem, fmt, fmtPct, itemTotals, sectionTotals, uid } from '../calc'

/** 엑셀처럼 글자가 다 보이도록 입력칸 너비를 내용 길이에 맞춘다 (한글은 두 칸으로 계산) */
function fitSize(value: string, min: number, max: number) {
  let w = 0
  for (const ch of value) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1
  return Math.max(min, Math.min(max, w + 2))
}

interface Props {
  sections: Section[]
  standards: Standards
  onChange: (next: Section[]) => void
}

export function ItemsEditor({ sections, standards, onChange }: Props) {
  const [catalogFor, setCatalogFor] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const categories = useMemo(
    () => Array.from(new Set(standards.catalog.map((c) => c.category))),
    [standards.catalog],
  )
  const [category, setCategory] = useState<string>('')

  /** 줄을 새로 넣은 뒤 그 줄의 품명 칸에 커서를 놓기 위한 표시 */
  const [pendingFocus, setPendingFocus] = useState<{ sid: string; idx: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pendingFocus) return
    const sel = `input[data-cell="${CSS.escape(pendingFocus.sid)}:${pendingFocus.idx}:name"]`
    const el = bodyRef.current?.querySelector<HTMLInputElement>(sel)
    el?.focus()
    el?.scrollIntoView({ block: 'nearest' })
    setPendingFocus(null)
  }, [pendingFocus, sections])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return standards.catalog.filter(
      (c) =>
        (!category || c.category === category) &&
        (!q || `${c.name} ${c.spec}`.toLowerCase().includes(q)),
    )
  }, [standards.catalog, category, query])

  const updateSection = (id: string, p: Partial<Section>) =>
    onChange(sections.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const updateItem = (sid: string, iid: string, p: Partial<LineItem>) =>
    onChange(
      sections.map((s) =>
        s.id === sid ? { ...s, items: s.items.map((i) => (i.id === iid ? { ...i, ...p } : i)) } : s,
      ),
    )

  /** 자동 생성된 줄을 직접 고치면 잠금 처리해서 재계산에 덮이지 않게 한다 */
  const editItem = (sid: string, item: LineItem, p: Partial<LineItem>) =>
    updateItem(sid, item.id, item.auto && !item.locked ? { ...p, locked: true } : p)

  const addItem = (sid: string, item?: LineItem) => {
    const sec = sections.find((s) => s.id === sid)
    setPendingFocus({ sid, idx: sec ? sec.items.length : 0 })
    onChange(
      sections.map((s) => (s.id === sid ? { ...s, items: [...s.items, item ?? emptyItem()] } : s)),
    )
  }

  /** Ctrl+Enter — 현재 줄 바로 아래에 빈 줄을 넣고 품명 칸으로 커서를 옮긴다 */
  const insertAfter = (sid: string, idx: number) => {
    setPendingFocus({ sid, idx: idx + 1 })
    onChange(
      sections.map((s) => {
        if (s.id !== sid) return s
        const items = [...s.items]
        items.splice(idx + 1, 0, emptyItem())
        return { ...s, items }
      }),
    )
  }

  const rowKeyDown = (sid: string, idx: number) => (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      insertAfter(sid, idx)
    }
  }

  const removeItem = (sid: string, iid: string) =>
    onChange(
      sections.map((s) => (s.id === sid ? { ...s, items: s.items.filter((i) => i.id !== iid) } : s)),
    )

  const moveItem = (sid: string, idx: number, dir: -1 | 1) =>
    onChange(
      sections.map((s) => {
        if (s.id !== sid) return s
        const items = [...s.items]
        const j = idx + dir
        if (j < 0 || j >= items.length) return s
        ;[items[idx], items[j]] = [items[j], items[idx]]
        return { ...s, items }
      }),
    )

  const addSection = () =>
    onChange([...sections, { id: uid('sec'), title: '- 새 그룹', items: [emptyItem()] }])

  const removeSection = (id: string) => onChange(sections.filter((s) => s.id !== id))

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }

  /** 숫자 칸도 자릿수만큼 넓어지게 (type=number 는 size 가 안 먹어서 min-width 로 맞춘다) */
  const numCell = (value: number, onSet: (v: number) => void) => {
    const digits = value ? String(Math.round(value)).length : 0
    return (
      <td className="num">
        <input
          type="number"
          style={{ minWidth: `${Math.max(7, digits + 2)}ch` }}
          value={value || ''}
          onChange={(e) => onSet(Number(e.target.value) || 0)}
        />
      </td>
    )
  }

  return (
    <div ref={bodyRef}>
      {sections.length === 0 && (
        <div className="notice">
          아직 항목이 없습니다. <b>견적 정보</b> 탭에서 Point·계측기·C/T·모듈·게이트웨이 갯수를 입력하면 기준에 따라 자동으로
          채워지고, 아래 <b>+ 그룹 추가</b>로 직접 넣을 수도 있습니다.
        </div>
      )}

      {sections.map((sec, si) => {
        const st = sectionTotals(sec)
        return (
          <div className="card" key={sec.id}>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                type="text"
                value={sec.title}
                onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                style={{ fontWeight: 700, maxWidth: 260 }}
              />
              <span className="muted">
                합계 <b>{fmt(st.total)}</b> · 원가 {fmt(st.costSum)} · 이익률 {fmtPct(st.margin)}
              </span>
              <div className="spacer" />
              <button className="btn sm" onClick={() => moveSection(si, -1)} disabled={si === 0}>
                ↑
              </button>
              <button
                className="btn sm"
                onClick={() => moveSection(si, 1)}
                disabled={si === sections.length - 1}
              >
                ↓
              </button>
              <button className="btn sm" onClick={() => removeSection(sec.id)}>
                그룹 삭제
              </button>
            </div>

            <div className="scroll-x">
              <table className="grid-table items-table">
                <thead>
                  <tr>
                    <th>품명</th>
                    <th>규격</th>
                    <th>단위</th>
                    <th>수량</th>
                    <th>재료비</th>
                    <th>노무비</th>
                    <th>경비</th>
                    <th>원가</th>
                    <th>합계</th>
                    <th>비고</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((it, ii) => {
                    const t = itemTotals(it)
                    return (
                      <tr key={it.id} onKeyDown={rowKeyDown(sec.id, ii)}>
                        <td>
                          <input
                            type="text"
                            data-cell={`${sec.id}:${ii}:name`}
                            size={fitSize(it.name, 14, 40)}
                            title={it.name}
                            value={it.name}
                            onChange={(e) => editItem(sec.id, it, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            size={fitSize(it.spec, 14, 44)}
                            title={it.spec}
                            value={it.spec}
                            onChange={(e) => editItem(sec.id, it, { spec: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            size={fitSize(it.unit, 4, 8)}
                            value={it.unit}
                            onChange={(e) => editItem(sec.id, it, { unit: e.target.value })}
                          />
                        </td>
                        {numCell(it.qty, (v) => editItem(sec.id, it, { qty: v }))}
                        {numCell(it.material, (v) => editItem(sec.id, it, { material: v }))}
                        {numCell(it.labor, (v) => editItem(sec.id, it, { labor: v }))}
                        {numCell(it.expense, (v) => editItem(sec.id, it, { expense: v }))}
                        {numCell(it.cost, (v) => editItem(sec.id, it, { cost: v }))}
                        <td style={{ textAlign: 'right', padding: '4px 6px', whiteSpace: 'nowrap' }}>
                          {fmt(t.total)}
                        </td>
                        <td>
                          <input
                            type="text"
                            size={fitSize(it.note, 12, 32)}
                            title={it.note}
                            value={it.note}
                            onChange={(e) => editItem(sec.id, it, { note: e.target.value })}
                          />
                        </td>
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {it.auto && (
                            <span
                              className={`tag ${it.locked ? 'lock' : 'auto'}`}
                              title={
                                it.locked
                                  ? '직접 수정함 — 기준 재적용 시 유지됩니다'
                                  : '견적 기준에서 자동 생성된 줄'
                              }
                            >
                              {it.locked ? '🔒' : '자동'}
                            </span>
                          )}
                          <button className="btn sm" onClick={() => moveItem(sec.id, ii, -1)}>
                            ↑
                          </button>
                          <button className="btn sm" onClick={() => moveItem(sec.id, ii, 1)}>
                            ↓
                          </button>
                          <button className="btn sm" onClick={() => removeItem(sec.id, it.id)}>
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => addItem(sec.id)}>
                + 빈 줄
              </button>
              <button
                className="btn sm"
                onClick={() => setCatalogFor(catalogFor === sec.id ? null : sec.id)}
              >
                + 단가표에서 추가
              </button>
              <span className="muted" style={{ fontSize: 11 }}>
                입력 중 <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 로 아래에 줄 추가
              </span>
            </div>

            {catalogFor === sec.id && (
              <div style={{ marginTop: 10, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 120 }}>
                    <option value="">전체</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="품명 / 규격 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  <table className="grid-table">
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id}>
                          <td style={{ padding: '4px 6px' }}>{c.name}</td>
                          <td style={{ padding: '4px 6px' }} className="muted">
                            {c.spec}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {fmt(c.material + c.labor + c.expense)}
                          </td>
                          <td style={{ width: 50, textAlign: 'center' }}>
                            <button
                              className="btn sm"
                              onClick={() =>
                                addItem(
                                  sec.id,
                                  emptyItem({
                                    name: c.name,
                                    spec: c.spec,
                                    unit: c.unit,
                                    qty: 1,
                                    material: c.material,
                                    labor: c.labor,
                                    expense: c.expense,
                                    cost: c.cost,
                                  }),
                                )
                              }
                            >
                              추가
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted" style={{ padding: 10, textAlign: 'center' }}>
                            검색 결과가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button className="btn primary" onClick={addSection}>
        + 그룹 추가
      </button>
    </div>
  )
}
