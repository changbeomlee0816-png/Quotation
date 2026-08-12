import { Fragment } from 'react'
import type { QuoteInput, Section, Standards } from '../types'
import type { QuotePage } from '../pages'
import {
  buildCover,
  fmt,
  fmtPct,
  formatDateKR,
  itemTotals,
  numberToHangul,
  pct,
  sectionTotals,
} from '../calc'

interface Props {
  pages: QuotePage[]
  selected: Set<string>
  input: QuoteInput
  standards: Standards
  sections: Section[]
  zoom: number
}

export function Preview({ pages, selected, input, standards, sections, zoom }: Props) {
  return (
    <div className="page-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
      {pages.map((p) => (
        <div
          key={p.id}
          className={`a4-page${selected.has(p.id) ? '' : ' dim'}`}
          data-page-id={p.id}
        >
          <div className="page-badge">
            {p.kind === 'cover' ? '갑지 (표지)' : p.label}
            {!selected.has(p.id) && ' · PDF 제외'}
          </div>
          {p.kind === 'cover' ? (
            <CoverPage input={input} standards={standards} sections={sections} />
          ) : (
            <DetailPage page={p} sections={sections} standards={standards} input={input} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 갑지                                                                */
/* ------------------------------------------------------------------ */

function CoverPage({
  input,
  standards: std,
  sections,
}: {
  input: QuoteInput
  standards: Standards
  sections: Section[]
}) {
  const cover = buildCover(sections, std)
  const s = std.supplier
  const BLANK_ROWS = 4

  const row = (k: string, v: string) => (
    <div className="meta-row">
      <span className="k">{k}</span>
      <span className="v">{v || '—'}</span>
    </div>
  )

  return (
    <>
      <div className="doc-head">
        <div className="doc-title">
          <span className="ko">견적서</span>
          <span className="en">QUOTATION</span>
        </div>
        <div className="issued">
          견적일자 <b>{formatDateKR(input.date)}</b>
          <br />
          유효기간 <b>{input.validity}</b>
        </div>
      </div>

      <div className="cover-meta">
        <div className="meta-block">
          <div className="cap">수 신 처</div>
          {row('업체명', input.customer)}
          {row('참　조', input.attn)}
          {row('제　목', input.subject)}
          {row('지불조건', input.payment)}
        </div>

        <div className="meta-block supplier-block">
          <div className="cap">공 급 자</div>
          <div className="supplier-name">{s.company}</div>
          <div className="supplier-addr">{s.address}</div>
          {row('사업자등록번호', s.bizNo)}
          <div className="meta-row">
            <span className="k">대표이사</span>
            <span className="v ceo">
              {s.ceo}
              {s.sealDataUrl ? (
                <img className="seal-img" src={s.sealDataUrl} alt="직인" />
              ) : (
                <span className="seal">(인)</span>
              )}
            </span>
          </div>
          {row('TEL / FAX', `${s.tel}  /  ${s.fax}`)}
          {row('담당자', s.manager)}
        </div>
      </div>

      <div className="amount-band">
        <span className="label">합 계 금 액</span>
        <span className="hangul">일금 {numberToHangul(cover.total)} 원정</span>
        <span className="num">₩{Math.round(cover.total).toLocaleString('ko-KR')}</span>
      </div>

      <table className="cover-table">
        <thead>
          <tr>
            <th style={{ width: '7%' }}>NO</th>
            <th style={{ width: '43%' }}>품명</th>
            <th style={{ width: '10%' }}>단위</th>
            <th style={{ width: '8%' }}>수량</th>
            <th style={{ width: '15%' }}>단가</th>
            <th style={{ width: '17%' }}>금액</th>
          </tr>
        </thead>
        <tbody>
          {cover.rows.map((r) => (
            <tr className="item" key={r.no}>
              <td className="c">{r.no}</td>
              <td className="name">{r.name}</td>
              <td className="c">{r.unit}</td>
              <td className="c">{r.qty}</td>
              <td className="r">{fmt(r.price)}</td>
              <td className="r">{fmt(r.amount)}</td>
            </tr>
          ))}
          {Array.from({ length: BLANK_ROWS }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
          <tr className="sub">
            <td></td>
            <td className="c" colSpan={4}>
              합　　계 (VAT 별도)
            </td>
            <td className="r">{fmt(cover.total)}</td>
          </tr>
          <tr className="vat">
            <td></td>
            <td className="c" colSpan={4}>
              부가세 ({pct(std.rates.vat)})
            </td>
            <td className="r">{fmt(cover.vat)}</td>
          </tr>
          <tr className="grand-total">
            <td></td>
            <td className="c" colSpan={4}>
              총　　계 (VAT 포함)
            </td>
            <td className="r">{fmt(cover.totalWithVat)}</td>
          </tr>
        </tbody>
      </table>

      <div className="cover-remarks">
        <div className="cap">특 기 사 항</div>
        {std.remarks.map((r, i) => (
          <div className="line" key={i}>
            {r}
          </div>
        ))}
      </div>

      <div className="page-foot">
        <span>{s.company}</span>
        <span>견적서 · {formatDateKR(input.date)}</span>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 상세내역 / 매출이익                                                  */
/* ------------------------------------------------------------------ */

function DetailPage({
  page,
  sections,
  standards: std,
  input,
}: {
  page: QuotePage
  sections: Section[]
  standards: Standards
  input: QuoteInput
}) {
  const withProfit = page.kind === 'profit'
  const cover = buildCover(sections, std)
  const byId = new Map(sections.map((s) => [s.id, s]))

  const grand = sections.reduce(
    (a, s) => {
      const t = sectionTotals(s)
      return {
        m: a.m + t.materialSum,
        l: a.l + t.laborSum,
        e: a.e + t.expenseSum,
        c: a.c + t.costSum,
        total: a.total + t.total,
      }
    },
    { m: 0, l: 0, e: 0, c: 0, total: 0 },
  )

  const cols = withProfit ? 14 : 12

  return (
    <>
      <div className="sheet-head">
        <span className="title">
          {withProfit ? '매출이익' : '상세내역'}
        </span>
        {withProfit && <span className="chip">내부용</span>}
        {page.totalOfKind > 1 && (
          <span className="page-no">
            {page.index} / {page.totalOfKind}
          </span>
        )}
      </div>
      <div className="sheet-sub">
        <span>단위 : 원 (VAT 별도)</span>
        <span>{formatDateKR(input.date)}</span>
      </div>

      <table className={`detail-table${withProfit ? ' profit' : ''}`}>
        <colgroup>
          {(withProfit
            ? [9.5, 8.5, 3.5, 4, 6.5, 8, 5.5, 7.5, 5.5, 7.5, 8.5, 8.5, 8.5, 8.5]
            : [12.5, 12.5, 4, 4.5, 7, 8.5, 6.5, 8, 6.5, 8, 9.5, 12.5]
          ).map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2}>품　명</th>
            <th rowSpan={2}>규　격</th>
            <th rowSpan={2}>단위</th>
            <th rowSpan={2}>수량</th>
            <th colSpan={2}>재료비</th>
            <th colSpan={2}>노무비</th>
            <th colSpan={2}>경비</th>
            <th rowSpan={2}>합계</th>
            {withProfit ? (
              <>
                <th rowSpan={2}>원가</th>
                <th rowSpan={2}>매출이익</th>
                <th rowSpan={2}>이익률</th>
              </>
            ) : (
              <th rowSpan={2}>비고</th>
            )}
          </tr>
          <tr>
            <th>단가</th>
            <th>소계</th>
            <th>단가</th>
            <th>소계</th>
            <th>단가</th>
            <th>소계</th>
          </tr>
        </thead>
        <tbody>
          {page.sections.map((ps, pi) => {
            const sec = byId.get(ps.sectionId)
            if (!sec) return null
            const st = sectionTotals(sec)
            const items = sec.items.slice(ps.from, ps.to + 1)
            return (
              <Fragment key={`${ps.sectionId}-${pi}`}>
                <tr className="sec">
                  <td className="title" colSpan={5}>
                    {ps.title}
                    {ps.continued && <span style={{ fontWeight: 400 }}> (계속)</span>}
                  </td>
                  <td>{ps.showHeader ? fmt(st.materialSum) : ''}</td>
                  <td></td>
                  <td>{ps.showHeader ? fmt(st.laborSum) : ''}</td>
                  <td></td>
                  <td>{ps.showHeader ? fmt(st.expenseSum) : ''}</td>
                  <td>{ps.showHeader ? fmt(st.total) : ''}</td>
                  {withProfit ? (
                    <>
                      <td>{ps.showHeader ? fmt(st.costSum) : ''}</td>
                      <td>{ps.showHeader ? fmt(st.profit) : ''}</td>
                      <td style={{ textAlign: 'center' }}>{ps.showHeader ? fmtPct(st.margin) : ''}</td>
                    </>
                  ) : (
                    <td></td>
                  )}
                </tr>
                {items.map((it) => {
                  const t = itemTotals(it)
                  return (
                    <tr key={it.id}>
                      <td className="c">{it.name}</td>
                      <td className="c">{it.spec}</td>
                      <td className="c">{it.unit}</td>
                      <td className="c">{it.qty || ''}</td>
                      <td className="r">{fmt(it.material)}</td>
                      <td className="r">{fmt(t.materialSum)}</td>
                      <td className="r">{fmt(it.labor)}</td>
                      <td className="r">{fmt(t.laborSum)}</td>
                      <td className="r">{fmt(it.expense)}</td>
                      <td className="r">{fmt(t.expenseSum)}</td>
                      <td className="r">{fmt(t.total)}</td>
                      {withProfit ? (
                        <>
                          <td className="r">{fmt(t.costSum)}</td>
                          <td className="r">{fmt(t.profit)}</td>
                          <td className="c">{fmtPct(t.margin)}</td>
                        </>
                      ) : (
                        <td className="note">{it.note}</td>
                      )}
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}

          {page.showGrandTotal && (
            <>
              <tr className="grand">
                <td className="title" colSpan={5}>
                  총 합계
                </td>
                <td>{fmt(grand.m)}</td>
                <td></td>
                <td>{fmt(grand.l)}</td>
                <td></td>
                <td>{fmt(grand.e)}</td>
                <td>{fmt(grand.total)}</td>
                {withProfit ? (
                  <>
                    <td>{fmt(grand.c)}</td>
                    <td>{fmt(grand.total - grand.c)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {fmtPct(grand.total ? (grand.total - grand.c) / grand.total : 0)}
                    </td>
                  </>
                ) : (
                  <td></td>
                )}
              </tr>

              {withProfit && (
                <>
                  <tr className="sec">
                    <td className="title" colSpan={cols}>
                      - 이윤 (갑지 요율)
                    </td>
                  </tr>
                  {(
                    [
                      [`일반관리비 ((재+노+경) × ${pct(std.rates.generalAdmin)})`, cover.generalAdmin],
                      [`안전 관리비 ((재+노) × ${pct(std.rates.safety)})`, cover.safety],
                      [`이윤 ((노+경+일반관리비) × ${pct(std.rates.profit)})`, cover.profitFee],
                    ] as [string, number][]
                  ).map(([label, v]) => (
                    <tr className="fee" key={label}>
                      <td className="c" colSpan={2}>
                        {label}
                      </td>
                      <td className="c">식</td>
                      <td className="c">1</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      {/* 경비 단가 칸은 폭이 좁아 비워 두고 소계에만 금액을 쓴다 (수량 1식) */}
                      <td></td>
                      <td className="r">{fmt(v)}</td>
                      <td className="r">{fmt(v)}</td>
                      <td className="r">-</td>
                      <td className="r">{fmt(v)}</td>
                      <td className="c">100.0%</td>
                    </tr>
                  ))}
                  <tr className="grand">
                    <td className="title" colSpan={5}>
                      최종 합계 (VAT 별도)
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>{fmt(cover.total)}</td>
                    <td>{fmt(cover.cost)}</td>
                    <td>{fmt(cover.grossProfit)}</td>
                    <td style={{ textAlign: 'center' }}>{fmtPct(cover.margin)}</td>
                  </tr>
                </>
              )}
            </>
          )}
        </tbody>
      </table>

      <div className="page-foot">
        <span>{std.supplier.company}</span>
        <span>{page.label}</span>
      </div>
    </>
  )
}
