import { useMemo, useState } from 'react'
import type { Customer } from '../types'
import { uid } from '../calc'

interface Props {
  customers: Customer[]
  onChange: (next: Customer[]) => void
}

export function CustomerEditor({ customers, onChange }: Props) {
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return customers
    return customers.filter((c) =>
      `${c.name} ${c.attn} ${c.tel} ${c.email} ${c.memo}`.toLowerCase().includes(s),
    )
  }, [customers, q])

  const set = (id: string, p: Partial<Customer>) =>
    onChange(customers.map((c) => (c.id === id ? { ...c, ...p } : c)))

  const add = () =>
    onChange([{ id: uid('cust'), name: '', attn: '', tel: '', email: '', memo: '' }, ...customers])

  const remove = (id: string) => onChange(customers.filter((c) => c.id !== id))

  const txt = (c: Customer, k: keyof Omit<Customer, 'id'>) => (
    <td>
      <input type="text" value={c[k]} onChange={(e) => set(c.id, { [k]: e.target.value })} />
    </td>
  )

  return (
    <div className="card">
      <h3>6) 거래처</h3>
      <p className="hint">
        여기 등록해 두면 <b>견적 정보</b> 탭의 업체명 칸에서 자동완성으로 고를 수 있고, 참조(담당자)까지
        같이 채워집니다.
      </p>

      <div className="row" style={{ marginBottom: 8 }}>
        <input
          type="text"
          placeholder="업체명 · 담당자 · 연락처 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <button className="btn sm primary" onClick={add}>
          + 거래처 추가
        </button>
      </div>

      <div className="scroll-x" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="grid-table items-table">
          <thead>
            <tr>
              <th>업체명</th>
              <th>참조 (담당자)</th>
              <th>연락처</th>
              <th>이메일</th>
              <th>메모</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                {txt(c, 'name')}
                {txt(c, 'attn')}
                {txt(c, 'tel')}
                {txt(c, 'email')}
                {txt(c, 'memo')}
                <td style={{ textAlign: 'center' }}>
                  <button
                    className="btn sm"
                    onClick={() => {
                      if (confirm(`${c.name || '이 거래처'} 를 지울까요?`)) remove(c.id)
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                  {customers.length === 0
                    ? '등록된 거래처가 없습니다. 견적 정보 탭에서 업체명을 넣고 "거래처 저장" 을 눌러도 추가됩니다.'
                    : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>
          {customers.length}개 거래처 {q ? `· ${shown.length}개 표시 중` : ''}
        </span>
      </div>
    </div>
  )
}
