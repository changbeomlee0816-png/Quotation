import { useMemo, useState } from 'react'
import type { CatalogEntry } from '../types'
import { uid } from '../calc'

interface Props {
  catalog: CatalogEntry[]
  onChange: (next: CatalogEntry[]) => void
}

/** 단가 카탈로그 편집 — 상세 항목 탭에서 "단가표에서 추가" 로 쓰이는 목록 */
export function CatalogEditor({ catalog, onChange }: Props) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.category).filter(Boolean))).sort(),
    [catalog],
  )

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return catalog.filter(
      (c) =>
        (!cat || c.category === cat) &&
        (!s || `${c.category} ${c.name} ${c.spec}`.toLowerCase().includes(s)),
    )
  }, [catalog, cat, q])

  const set = (id: string, p: Partial<CatalogEntry>) =>
    onChange(catalog.map((c) => (c.id === id ? { ...c, ...p } : c)))

  const add = () =>
    onChange([
      { id: uid('cat'), category: cat || '기타', name: '', spec: '', unit: 'EA', material: 0, labor: 0, expense: 0, cost: 0 },
      ...catalog,
    ])

  const remove = (id: string) => onChange(catalog.filter((c) => c.id !== id))

  const txt = (c: CatalogEntry, k: 'category' | 'name' | 'spec' | 'unit') => (
    <td>
      <input type="text" value={c[k]} onChange={(e) => set(c.id, { [k]: e.target.value })} />
    </td>
  )
  const numv = (c: CatalogEntry, k: 'material' | 'labor' | 'expense' | 'cost') => (
    <td className="num">
      <input
        type="number"
        value={c[k] || ''}
        onChange={(e) => set(c.id, { [k]: Number(e.target.value) || 0 })}
      />
    </td>
  )

  return (
    <div className="card">
      <h3>7) 단가 카탈로그</h3>
      <p className="hint">
        상세 항목 탭의 <b>+ 단가표에서 추가</b> 목록입니다. 자주 쓰는 자재·노무 단가를 여기서 관리하세요.
        원가 칸은 비워 두면 매출이익이 100% 로 잡힙니다.
      </p>

      <div className="row" style={{ marginBottom: 8 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 120 }}>
          <option value="">전체 분류</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="분류 · 품명 · 규격 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <button className="btn sm primary" onClick={add}>
          + 품목 추가
        </button>
      </div>

      <div className="scroll-x" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table className="grid-table items-table">
          <thead>
            <tr>
              <th>분류</th>
              <th>품명</th>
              <th>규격</th>
              <th>단위</th>
              <th>재료비</th>
              <th>노무비</th>
              <th>경비</th>
              <th>원가</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                {txt(c, 'category')}
                {txt(c, 'name')}
                {txt(c, 'spec')}
                {txt(c, 'unit')}
                {numv(c, 'material')}
                {numv(c, 'labor')}
                {numv(c, 'expense')}
                {numv(c, 'cost')}
                <td style={{ textAlign: 'center' }}>
                  <button className="btn sm" onClick={() => remove(c.id)} title="삭제">
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                  {catalog.length === 0 ? '등록된 품목이 없습니다.' : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>
          {catalog.length}개 품목 {q || cat ? `· ${shown.length}개 표시 중` : ''}
        </span>
      </div>
    </div>
  )
}
