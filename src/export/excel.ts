import ExcelJS from 'exceljs'
import type { Section, Standards, QuoteInput } from '../types'
import { buildCover, formatDateKR, hangulAmountLine, itemTotals, pct } from '../calc'

const FONT = '맑은 고딕'
const MONEY = '#,##0'
const ACCT = '_ * #,##0_ ;_ * \\-#,##0_ ;_ * "-"_ ;_ @_ '
const COVER_MONEY = '#,##0_);[Red]\\(#,##0\\)'
const PCT = '0%'

const C = {
  headerGreen: 'FFCCFFCC',
  headerWhite: 'FFFFFFFF',
  section: 'FFF2F2F2',
  totalDetail: 'FF93CDDD',
  totalProfit: 'FFB7DEE8',
}

type BStyle = 'thin' | 'medium' | 'double' | 'hair'
type Sides = { l?: BStyle; r?: BStyle; t?: BStyle; b?: BStyle }

function border(s: Sides): Partial<ExcelJS.Borders> {
  const g = (v?: BStyle) => (v ? { style: v } : undefined)
  return { left: g(s.l), right: g(s.r), top: g(s.t), bottom: g(s.b) } as Partial<ExcelJS.Borders>
}

function fill(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

interface CellOpts {
  font?: Partial<ExcelJS.Font>
  numFmt?: string
  align?: Partial<ExcelJS.Alignment>
  border?: Sides
  fill?: string
}

function set(ws: ExcelJS.Worksheet, addr: string, value: ExcelJS.CellValue, o: CellOpts = {}) {
  const cell = ws.getCell(addr)
  if (value !== undefined) cell.value = value
  cell.font = { name: FONT, size: 9, ...o.font }
  cell.alignment = { vertical: 'middle', ...o.align }
  if (o.numFmt) cell.numFmt = o.numFmt
  if (o.border) cell.border = border(o.border)
  if (o.fill) cell.fill = fill(o.fill)
  return cell
}

/** 범위 전체에 동일 테두리를 두르되 바깥쪽만 medium 으로 */
function boxRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, inner: BStyle, outer: BStyle) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = border({
        l: c === c1 ? outer : inner,
        r: c === c2 ? outer : inner,
        t: r === r1 ? outer : inner,
        b: r === r2 ? outer : inner,
      })
    }
  }
}

/* ================================================================== */
/* 상세내역 / 매출이익 공통 행 배치 계산                                  */
/* ================================================================== */

export interface DetailLayout {
  /** 섹션 헤더 행 번호 → 그 섹션의 아이템 행 범위 */
  sections: { title: string; headerRow: number; first: number; last: number }[]
  totalRow: number
  lastRow: number
}

const HEADER_ROW = 5
const FIRST_DATA_ROW = 7

export function layoutDetail(sections: Section[]): DetailLayout {
  let row = FIRST_DATA_ROW
  const out: DetailLayout['sections'] = []
  for (const s of sections) {
    const headerRow = row
    const first = row + 1
    const last = row + s.items.length
    out.push({ title: s.title, headerRow, first, last })
    row = last + 1
  }
  return { sections: out, totalRow: row, lastRow: row }
}

/* ================================================================== */
/* 시트 1 — 갑지                                                       */
/* ================================================================== */

const COVER_FIRST = 16
const COVER_BLANK_END = 25
const COVER_TOTAL_ROW = 26

function buildCoverSheet(
  wb: ExcelJS.Workbook,
  input: QuoteInput,
  std: Standards,
  sections: Section[],
  detailTotalRow: number,
) {
  const ws = wb.addWorksheet('갑지')
  const cover = buildCover(sections, std)

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    scale: 90,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }
  const widths: Record<string, number> = { A: 5.2, B: 17.6, C: 9, D: 7.2, E: 5.7, F: 13.1, G: 22.6 }
  Object.entries(widths).forEach(([k, v]) => (ws.getColumn(k).width = v))
  for (let r = 1; r <= 30; r++) ws.getRow(r).height = 20.7

  // 제목
  ws.mergeCells('A1:G2')
  set(ws, 'A1', '견   적   서', {
    font: { size: 22, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
  })
  boxRange(ws, 1, 1, 2, 7, 'medium', 'medium')
  set(ws, 'A1', '견   적   서', {
    font: { size: 22, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
    border: { l: 'medium', r: 'medium', t: 'medium', b: 'medium' },
  })

  const left: [string, string][] = [
    ['A5:D5', `수   신 : ${input.customer}`],
    ['A6:D6', `참   조 : ${input.attn}`],
    ['A7:D7', `제   목 : ${input.subject}`],
    ['A8:D8', `날   짜 : ${formatDateKR(input.date)}`],
    ['A9:D9', `유효기간 : ${input.validity}`],
    ['A10:D10', `지불조건 : ${input.payment}`],
  ]
  for (const [range, text] of left) {
    ws.mergeCells(range)
    set(ws, range.split(':')[0], text, {
      font: { size: 10, bold: true },
      align: { horizontal: 'left', vertical: 'middle' },
    })
  }

  const s = std.supplier
  ws.mergeCells('E4:G5')
  const right: [string, string][] = [
    ['E6:G6', s.address],
    ['E7:G7', s.company],
    ['E8:G8', `사업자등록번호 : ${s.bizNo}`],
    ['E9:G9', `대 표 이 사   :   ${s.ceo}`],
    ['E10:G10', `T E L : ${s.tel}`],
    ['E11:G11', `F A X : ${s.fax}`],
    ['E12:G12', `담 당 자 : ${s.manager}`],
  ]
  for (const [range, text] of right) {
    ws.mergeCells(range)
    set(ws, range.split(':')[0], text, {
      font: { size: 11, bold: true },
      align: { horizontal: 'left', vertical: 'middle' },
    })
  }

  // 합계금액 (한글) — 엑셀 전용 NUMBERSTRING 대신 계산된 문자열을 기록
  ws.mergeCells('A14:G14')
  set(ws, 'A14', hangulAmountLine(cover.total), {
    font: { size: 11, bold: true },
    align: { horizontal: 'left', vertical: 'middle' },
    border: { b: 'medium' },
  })

  // 표 머리
  const heads: [string, string][] = [
    ['A15', 'NO'],
    ['B15', '품명'],
    ['D15', '단위'],
    ['E15', '수량'],
    ['F15', '단가'],
    ['G15', '금액'],
  ]
  ws.mergeCells('B15:C15')
  for (const [addr, text] of heads) {
    set(ws, addr, text, {
      font: { size: 11, bold: true },
      align: { horizontal: 'center', vertical: 'middle' },
      fill: C.headerWhite,
    })
  }
  for (let c = 1; c <= 7; c++) {
    ws.getCell(15, c).border = border({ l: c === 1 ? 'medium' : 'thin', r: c === 7 ? 'medium' : 'thin', t: 'medium' })
  }

  // 본문 6줄 + 여백줄
  const rows = cover.rows
  for (let i = 0; i < COVER_BLANK_END - COVER_FIRST + 1; i++) {
    const r = COVER_FIRST + i
    ws.mergeCells(`B${r}:C${r}`)
    const isFirst = r === COVER_FIRST
    const b: Sides = { t: isFirst ? 'double' : 'hair', b: 'hair' }
    const data = rows[i]
    set(ws, `A${r}`, data ? data.no : null, {
      font: { size: 10 },
      align: { horizontal: 'center', vertical: 'middle' },
      border: { ...b, l: 'medium', r: 'thin' },
    })
    set(ws, `B${r}`, data ? data.name : null, {
      font: { size: 9, bold: true },
      numFmt: '@',
      align: { horizontal: 'left', vertical: 'middle' },
      border: { ...b, l: 'thin', r: 'thin' },
    })
    ws.getCell(`C${r}`).border = border({ ...b, l: 'thin', r: 'thin' })
    set(ws, `D${r}`, data ? data.unit : null, {
      font: { size: 9, bold: true },
      align: { horizontal: 'center', vertical: 'middle' },
      border: { ...b, l: 'thin', r: 'thin' },
    })
    set(ws, `E${r}`, data ? data.qty : null, {
      font: { size: 9, bold: true },
      align: { horizontal: 'center', vertical: 'middle' },
      border: { ...b, l: 'thin', r: 'thin' },
    })

    // 단가: 1~3 은 상세내역 총계 참조, 4~6 은 요율 계산식
    let priceFormula: ExcelJS.CellValue = null
    if (i === 0) priceFormula = { formula: `상세내역!F${detailTotalRow}`, result: cover.material }
    else if (i === 1) priceFormula = { formula: `상세내역!H${detailTotalRow}`, result: cover.labor }
    else if (i === 2) priceFormula = { formula: `상세내역!J${detailTotalRow}`, result: cover.expense }
    else if (i === 3)
      priceFormula = { formula: `(F16+F17+F18)*${std.rates.generalAdmin}`, result: cover.generalAdmin }
    else if (i === 4) priceFormula = { formula: `(F16+F17)*${std.rates.safety}`, result: cover.safety }
    else if (i === 5) priceFormula = { formula: `(F17+F18+F19)*${std.rates.profit}`, result: cover.profitFee }

    set(ws, `F${r}`, priceFormula, {
      font: { size: 9, bold: true },
      numFmt: ACCT,
      align: { vertical: 'middle' },
      border: { ...b, l: 'thin', r: 'thin' },
    })
    set(ws, `G${r}`, data ? { formula: `E${r}*F${r}`, result: data.amount } : null, {
      font: { size: 9, bold: true },
      numFmt: COVER_MONEY,
      align: { vertical: 'middle' },
      border: { ...b, l: 'thin', r: 'medium' },
    })
  }

  // 합계
  const tr = COVER_TOTAL_ROW
  ws.mergeCells(`B${tr}:F${tr}`)
  set(ws, `A${tr}`, null, { border: { l: 'medium', r: 'thin', b: 'medium' } })
  set(ws, `B${tr}`, '합       계 (VAT 별도)', {
    font: { size: 11, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
    border: { l: 'thin', r: 'thin', b: 'medium' },
  })
  set(
    ws,
    `G${tr}`,
    { formula: `ROUNDDOWN(SUM(G${COVER_FIRST}:G${COVER_BLANK_END}),${std.rates.roundDownDigits})`, result: cover.total },
    {
      font: { size: 11, bold: true },
      numFmt: COVER_MONEY,
      align: { vertical: 'middle' },
      border: { l: 'thin', r: 'medium', b: 'medium' },
    },
  )

  // 특기사항
  set(ws, 'B28', '* 특 기 사 항', { font: { size: 11, bold: true }, align: { vertical: 'middle' } })
  std.remarks.forEach((line, i) => {
    set(ws, `B${29 + i}`, line, {
      font: { size: 11, bold: true },
      align: { horizontal: 'left', vertical: 'middle' },
    })
  })

  return ws
}

/* ================================================================== */
/* 시트 2 / 3 — 상세내역, 매출이익                                       */
/* ================================================================== */

function detailHeader(ws: ExcelJS.Worksheet, title: string, lastCol: number, withProfit: boolean) {
  const lastLetter = ws.getColumn(lastCol).letter
  ws.mergeCells(`A1:${lastLetter}4`)
  set(ws, 'A1', title, {
    font: { size: 16, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
  })
  boxRange(ws, 1, 1, 4, lastCol, 'medium', 'medium')
  set(ws, 'A1', title, {
    font: { size: 16, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
  })
  ws.getRow(1).height = 39.6
  ws.getRow(4).height = 18

  const h = HEADER_ROW
  const single: [string, string][] = [
    ['A', '품     명'],
    ['B', '규   격'],
    ['C', '단위'],
    ['D', '수 량'],
    ['K', '합계'],
  ]
  const pairs: [string, string, string][] = [
    ['E', 'F', '재료비'],
    ['G', 'H', '노무비'],
    ['I', 'J', '경비'],
  ]
  const tail: [string, string][] = withProfit
    ? [
        ['L', '원가'],
        ['M', '매출이익'],
        ['N', '매출이익률'],
      ]
    : [['L', '비고']]

  for (const [col, text] of [...single, ...tail]) {
    ws.mergeCells(`${col}${h}:${col}${h + 1}`)
    set(ws, `${col}${h}`, text, {
      align: { horizontal: 'center', vertical: 'middle' },
      fill: C.headerGreen,
    })
  }
  for (const [c1, c2, text] of pairs) {
    ws.mergeCells(`${c1}${h}:${c2}${h}`)
    set(ws, `${c1}${h}`, text, { align: { horizontal: 'center', vertical: 'middle' }, fill: C.headerGreen })
    set(ws, `${c1}${h + 1}`, '단가', { align: { horizontal: 'center', vertical: 'middle' }, fill: C.headerGreen })
    set(ws, `${c2}${h + 1}`, '소계', { align: { horizontal: 'center', vertical: 'middle' }, fill: C.headerGreen })
  }
  for (let r = h; r <= h + 1; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c)
      cell.fill = fill(C.headerGreen)
      cell.border = border({
        l: c === 1 ? 'medium' : 'thin',
        r: c === lastCol ? 'medium' : 'thin',
        t: r === h ? 'medium' : 'thin',
        b: r === h + 1 ? 'thin' : 'thin',
      })
    }
  }
}

function buildDetailSheet(wb: ExcelJS.Workbook, sections: Section[], withProfit: boolean) {
  const name = withProfit ? '매출이익' : '상세내역'
  const ws = wb.addWorksheet(name)
  const lastCol = withProfit ? 14 : 12

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    scale: 36,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }
  const widths: Record<string, number> = {
    A: 24, B: 27.7, C: 6, D: 9, E: 14.8, F: 14.8, G: 12, H: 14, I: 12, J: 14, K: 17.9,
  }
  if (withProfit) Object.assign(widths, { L: 14.8, M: 14.8, N: 16.9 })
  else Object.assign(widths, { L: 18.9 })
  Object.entries(widths).forEach(([k, v]) => (ws.getColumn(k).width = v))

  const title = withProfit ? '스마트분전반 시공 매출이익' : '스마트분전반, 계측시공 견적'
  detailHeader(ws, title, lastCol, withProfit)

  const layout = layoutDetail(sections)

  const money = (r: number, col: string, v: ExcelJS.CellValue, o: CellOpts = {}) =>
    set(ws, `${col}${r}`, v, {
      numFmt: MONEY,
      align: { horizontal: 'right', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
      ...o,
    })

  sections.forEach((sec, si) => {
    const L = layout.sections[si]

    // 섹션 헤더 행
    const hr = L.headerRow
    ws.getRow(hr).height = 27.6
    set(ws, `A${hr}`, sec.title, {
      font: { size: 10, bold: true },
      align: { horizontal: 'left', vertical: 'middle' },
      fill: C.section,
      border: { l: 'medium', r: 'thin', t: 'thin', b: 'thin' },
    })
    for (let c = 2; c <= lastCol; c++) {
      const cell = ws.getCell(hr, c)
      cell.font = { name: FONT, size: 10, bold: true }
      cell.fill = fill(C.section)
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      cell.border = border({ l: 'thin', r: c === lastCol ? 'medium' : 'thin', t: 'thin', b: 'thin' })
    }
    const has = sec.items.length > 0
    const rng = (col: string) => `${col}${L.first}:${col}${L.last}`
    const st = sec.items.reduce(
      (a, it) => {
        const t = itemTotals(it)
        return {
          m: a.m + t.materialSum,
          l: a.l + t.laborSum,
          e: a.e + t.expenseSum,
          c: a.c + t.costSum,
        }
      },
      { m: 0, l: 0, e: 0, c: 0 },
    )
    const secTotal = st.m + st.l + st.e
    if (has) {
      money(hr, 'F', { formula: `SUM(${rng('F')})`, result: st.m }, { font: { size: 10, bold: true }, fill: C.section })
      money(hr, 'H', { formula: `SUM(${rng('H')})`, result: st.l }, { font: { size: 10, bold: true }, fill: C.section })
      money(hr, 'J', { formula: `SUM(${rng('J')})`, result: st.e }, { font: { size: 10, bold: true }, fill: C.section })
      money(hr, 'K', { formula: `F${hr}+H${hr}+J${hr}`, result: secTotal }, { font: { size: 10, bold: true }, fill: C.section })
      if (withProfit) {
        money(hr, 'L', { formula: `SUM(${rng('L')})`, result: st.c }, { font: { size: 10, bold: true }, fill: C.section })
        money(hr, 'M', { formula: `K${hr}-L${hr}`, result: secTotal - st.c }, { font: { size: 10, bold: true }, fill: C.section })
        set(ws, `N${hr}`, { formula: `IFERROR(M${hr}/K${hr},0)`, result: secTotal ? (secTotal - st.c) / secTotal : 0 }, {
          font: { size: 10, bold: true },
          numFmt: PCT,
          align: { horizontal: 'center', vertical: 'middle' },
          fill: C.section,
          border: { l: 'thin', r: 'medium', t: 'thin', b: 'thin' },
        })
      }
    }

    // 아이템 행
    sec.items.forEach((it, ii) => {
      const r = L.first + ii
      const t = itemTotals(it)
      const txt: CellOpts = {
        align: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
      }
      set(ws, `A${r}`, it.name, { ...txt, border: { ...txt.border, l: 'medium' } })
      set(ws, `B${r}`, it.spec, txt)
      set(ws, `C${r}`, it.unit, txt)
      set(ws, `D${r}`, it.qty || null, txt)

      const unitPrice = (col: string, v: number) =>
        money(r, col, v || null, { font: { size: 10 } })
      const subTotal = (col: string, unitCol: string, v: number) =>
        money(r, col, v ? { formula: `D${r}*${unitCol}${r}`, result: v } : null, {
          align: { horizontal: 'right', vertical: 'middle', wrapText: true },
        })

      unitPrice('E', it.material)
      subTotal('F', 'E', t.materialSum)
      unitPrice('G', it.labor)
      subTotal('H', 'G', t.laborSum)
      unitPrice('I', it.expense)
      subTotal('J', 'I', t.expenseSum)
      money(r, 'K', { formula: `F${r}+H${r}+J${r}`, result: t.total })

      if (withProfit) {
        money(r, 'L', it.cost ? { formula: `D${r}*${it.cost}`, result: t.costSum } : null)
        money(r, 'M', { formula: `K${r}-L${r}`, result: t.profit })
        set(ws, `N${r}`, { formula: `IFERROR(M${r}/K${r},0)`, result: t.margin }, {
          numFmt: PCT,
          align: { horizontal: 'center', vertical: 'middle' },
          border: { l: 'thin', r: 'medium', t: 'thin', b: 'thin' },
        })
      } else {
        set(ws, `L${r}`, it.note, {
          align: { horizontal: 'right', vertical: 'middle' },
          border: { l: 'thin', r: 'medium', t: 'thin', b: 'thin' },
        })
      }
    })
  })

  return { ws, layout, lastCol }
}

/** 상세내역 총합계 행 */
function writeDetailTotal(
  ws: ExcelJS.Worksheet,
  layout: DetailLayout,
  sections: Section[],
  lastCol: number,
  withProfit: boolean,
) {
  const tr = layout.totalRow
  ws.getRow(tr).height = 39
  const headerRows = layout.sections.map((s) => s.headerRow)
  const sumOf = (col: string) => headerRows.map((r) => `${col}${r}`).join('+') || '0'

  const totals = sections.reduce(
    (a, s) => {
      for (const it of s.items) {
        const t = itemTotals(it)
        a.m += t.materialSum
        a.l += t.laborSum
        a.e += t.expenseSum
        a.c += t.costSum
      }
      return a
    },
    { m: 0, l: 0, e: 0, c: 0 },
  )
  const grand = totals.m + totals.l + totals.e

  ws.mergeCells(`A${tr}:D${tr}`)
  set(ws, `A${tr}`, '총 합계', {
    font: { size: 12, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
    fill: withProfit ? C.totalProfit : C.totalDetail,
    border: { l: 'medium', r: 'thin', t: 'thin', b: 'medium' },
  })
  for (let c = 2; c <= lastCol; c++) {
    const cell = ws.getCell(tr, c)
    cell.fill = fill(withProfit ? C.totalProfit : C.totalDetail)
    cell.font = { name: FONT, size: 12, bold: true }
    cell.alignment = { vertical: 'middle' }
    cell.border = border({ l: 'thin', r: c === lastCol ? 'medium' : 'thin', t: 'thin', b: 'medium' })
  }

  const put = (col: string, formula: string, result: number, numFmt = ACCT) =>
    set(ws, `${col}${tr}`, { formula, result }, {
      font: { size: 12, bold: true },
      numFmt,
      align: { vertical: 'middle' },
      fill: withProfit ? C.totalProfit : C.totalDetail,
      border: { l: 'thin', r: col === 'N' || (!withProfit && col === 'L') ? 'medium' : 'thin', t: 'thin', b: 'medium' },
    })

  put('F', sumOf('F'), totals.m)
  put('H', sumOf('H'), totals.l)
  put('J', sumOf('J'), totals.e)
  put('K', sumOf('K'), grand)
  if (withProfit) {
    put('L', sumOf('L'), totals.c)
    put('M', `K${tr}-L${tr}`, grand - totals.c)
    set(ws, `N${tr}`, { formula: `IFERROR(M${tr}/K${tr},0)`, result: grand ? (grand - totals.c) / grand : 0 }, {
      font: { size: 12, bold: true },
      numFmt: PCT,
      align: { horizontal: 'center', vertical: 'middle' },
      fill: C.totalProfit,
      border: { l: 'thin', r: 'medium', t: 'thin', b: 'medium' },
    })
  }
}

/* ================================================================== */
/* 진입점                                                              */
/* ================================================================== */

export async function buildWorkbook(
  input: QuoteInput,
  std: Standards,
  sections: Section[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = std.supplier.company
  wb.created = new Date()

  const layout = layoutDetail(sections)

  buildCoverSheet(wb, input, std, sections, layout.totalRow)

  const detail = buildDetailSheet(wb, sections, false)
  writeDetailTotal(detail.ws, detail.layout, sections, detail.lastCol, false)

  const profit = buildDetailSheet(wb, sections, true)
  writeDetailTotal(profit.ws, profit.layout, sections, profit.lastCol, true)

  // 매출이익 시트 하단 - 이윤 (갑지 요율) 반영
  appendProfitFeeBlock(profit.ws, profit.layout, sections, std)

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

/**
 * 매출이익 시트의 총합계 아래에, 갑지에서 계산된 일반관리비/안전관리비/이윤을
 * 원가 0 으로 덧붙여 최종 매출·이익을 보여준다.
 */
function appendProfitFeeBlock(
  ws: ExcelJS.Worksheet,
  layout: DetailLayout,
  sections: Section[],
  std: Standards,
) {
  const cover = buildCover(sections, std)
  const start = layout.totalRow + 2

  const head = start
  set(ws, `A${head}`, '- 이윤 (갑지 요율)', {
    font: { size: 10, bold: true },
    align: { horizontal: 'left', vertical: 'middle' },
    fill: C.section,
    border: { l: 'medium', r: 'thin', t: 'thin', b: 'thin' },
  })
  for (let c = 2; c <= 14; c++) {
    const cell = ws.getCell(head, c)
    cell.fill = fill(C.section)
    cell.font = { name: FONT, size: 10, bold: true }
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    cell.border = border({ l: 'thin', r: c === 14 ? 'medium' : 'thin', t: 'thin', b: 'thin' })
  }

  const rows: [string, number, string][] = [
    [`일반관리비 ((재+노+경) × ${pct(std.rates.generalAdmin)})`, cover.generalAdmin, 'F19'],
    [`안전 관리비 ((재+노) × ${pct(std.rates.safety)})`, cover.safety, 'F20'],
    [`이윤 ((노+경+일반관리비) × ${pct(std.rates.profit)})`, cover.profitFee, 'F21'],
  ]

  rows.forEach(([label, value, coverRef], i) => {
    const r = head + 1 + i
    set(ws, `A${r}`, label, {
      align: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: { l: 'medium', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `B${r}`, '', { border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' } })
    set(ws, `C${r}`, '식', {
      align: { horizontal: 'center', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `D${r}`, 1, {
      align: { horizontal: 'center', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    for (const col of ['E', 'F', 'G', 'H']) {
      set(ws, `${col}${r}`, null, { border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' } })
    }
    set(ws, `I${r}`, { formula: `갑지!${coverRef}`, result: value }, {
      numFmt: MONEY,
      align: { horizontal: 'right', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `J${r}`, { formula: `D${r}*I${r}`, result: value }, {
      numFmt: MONEY,
      align: { horizontal: 'right', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `K${r}`, { formula: `F${r}+H${r}+J${r}`, result: value }, {
      numFmt: MONEY,
      align: { horizontal: 'right', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `L${r}`, 0, {
      numFmt: MONEY,
      align: { horizontal: 'right', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `M${r}`, { formula: `K${r}-L${r}`, result: value }, {
      numFmt: MONEY,
      align: { horizontal: 'right', vertical: 'middle' },
      border: { l: 'thin', r: 'thin', t: 'thin', b: 'thin' },
    })
    set(ws, `N${r}`, { formula: `IFERROR(M${r}/K${r},0)`, result: 1 }, {
      numFmt: PCT,
      align: { horizontal: 'center', vertical: 'middle' },
      border: { l: 'thin', r: 'medium', t: 'thin', b: 'thin' },
    })
  })

  // 최종 합계
  const fr = head + 4
  const dt = layout.totalRow
  ws.getRow(fr).height = 39
  ws.mergeCells(`A${fr}:D${fr}`)
  set(ws, `A${fr}`, '최종 합계 (VAT 별도)', {
    font: { size: 12, bold: true },
    align: { horizontal: 'center', vertical: 'middle' },
    fill: C.totalProfit,
    border: { l: 'medium', r: 'thin', t: 'thin', b: 'medium' },
  })
  for (let c = 2; c <= 14; c++) {
    const cell = ws.getCell(fr, c)
    cell.fill = fill(C.totalProfit)
    cell.font = { name: FONT, size: 12, bold: true }
    cell.alignment = { vertical: 'middle' }
    cell.border = border({ l: 'thin', r: c === 14 ? 'medium' : 'thin', t: 'thin', b: 'medium' })
  }
  const feeRows = [head + 1, head + 2, head + 3]
  const put = (col: string, formula: string, result: number, numFmt = ACCT) =>
    set(ws, `${col}${fr}`, { formula, result }, {
      font: { size: 12, bold: true },
      numFmt,
      align: { vertical: 'middle' },
      fill: C.totalProfit,
      border: { l: 'thin', r: col === 'N' ? 'medium' : 'thin', t: 'thin', b: 'medium' },
    })

  put('J', `J${dt}+${feeRows.map((r) => `J${r}`).join('+')}`, cover.expense + cover.generalAdmin + cover.safety + cover.profitFee)
  put(
    'K',
    `ROUNDDOWN(K${dt}+${feeRows.map((r) => `K${r}`).join('+')},${std.rates.roundDownDigits})`,
    cover.total,
  )
  put('L', `L${dt}`, cover.cost)
  put('M', `K${fr}-L${fr}`, cover.grossProfit)
  set(ws, `N${fr}`, { formula: `IFERROR(M${fr}/K${fr},0)`, result: cover.margin }, {
    font: { size: 12, bold: true },
    numFmt: PCT,
    align: { horizontal: 'center', vertical: 'middle' },
    fill: C.totalProfit,
    border: { l: 'thin', r: 'medium', t: 'thin', b: 'medium' },
  })
}

export function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
