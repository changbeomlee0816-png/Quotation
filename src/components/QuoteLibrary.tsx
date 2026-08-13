import { useMemo, useState } from 'react'
import type { SavedQuote } from '../types'
import { fmt, formatDateKR } from '../calc'

interface Props {
  list: SavedQuote[]
  currentNo: string
  onOpen: (q: SavedQuote) => void
  onDuplicate: (q: SavedQuote) => void
  onRemove: (id: string) => void
  onClose: () => void
}

export function QuoteLibrary({ list, currentNo, onOpen, onDuplicate, onRemove, onClose }: Props) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((it) =>
      `${it.quoteNo} ${it.customer} ${it.subject}`.toLowerCase().includes(s),
    )
  }, [list, q])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>견적 이력</h2>
          <span className="muted">{list.length}건 저장됨</span>
          <div className="spacer" />
          <button className="btn sm" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="modal-tools">
          <input
            type="text"
            autoFocus
            placeholder="견적번호 · 업체명 · 제목 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="modal-body">
          {filtered.length === 0 ? (
            <div className="empty">
              {list.length === 0 ? (
                <>
                  아직 저장된 견적이 없습니다.
                  <br />
                  상단 <b>견적 저장</b> 을 누르면 지금 작성 중인 견적이 여기에 쌓입니다.
                </>
              ) : (
                '검색 결과가 없습니다.'
              )}
            </div>
          ) : (
            <table className="lib-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>견적번호</th>
                  <th style={{ width: 130 }}>업체명</th>
                  <th>제목</th>
                  <th style={{ width: 96 }}>견적일</th>
                  <th style={{ width: 110 }}>합계</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className={it.quoteNo === currentNo ? 'on' : ''}>
                    <td>
                      <b>{it.quoteNo || '—'}</b>
                      {it.quoteNo === currentNo && <span className="tag" style={{ marginLeft: 6 }}>작업 중</span>}
                    </td>
                    <td>{it.customer || '—'}</td>
                    <td className="ell" title={it.subject}>
                      {it.subject || '—'}
                    </td>
                    <td>{formatDateKR(it.date)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(it.total)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn sm primary" onClick={() => onOpen(it)}>
                        열기
                      </button>
                      <button className="btn sm" onClick={() => onDuplicate(it)}>
                        복제
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => {
                          if (confirm(`${it.quoteNo || '이 견적'} 을 목록에서 지울까요?`)) onRemove(it.id)
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-foot muted">
          견적은 이 브라우저에만 저장됩니다. 다른 PC 와 나누려면 상단 <b>기준·견적 저장</b> 으로 JSON 을
          받아 옮기세요.
        </div>
      </div>
    </div>
  )
}
