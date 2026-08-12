import type {
  AutoRuleId,
  CloudTier,
  LineItem,
  QuoteInput,
  Section,
  Standards,
  UnitRule,
} from './types'

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyItem(partial: Partial<LineItem> = {}): LineItem {
  return {
    id: uid('li'),
    name: '',
    spec: '',
    unit: '',
    qty: 0,
    material: 0,
    labor: 0,
    expense: 0,
    cost: 0,
    note: '',
    ...partial,
  }
}

/* ------------------------------------------------------------------ */
/* 줄 / 그룹 합계                                                       */
/* ------------------------------------------------------------------ */

export interface ItemTotals {
  materialSum: number
  laborSum: number
  expenseSum: number
  costSum: number
  total: number
  profit: number
  margin: number
}

export function itemTotals(it: LineItem): ItemTotals {
  const materialSum = round0(it.qty * it.material)
  const laborSum = round0(it.qty * it.labor)
  const expenseSum = round0(it.qty * it.expense)
  const costSum = round0(it.qty * it.cost)
  const total = materialSum + laborSum + expenseSum
  const profit = total - costSum
  return { materialSum, laborSum, expenseSum, costSum, total, profit, margin: total ? profit / total : 0 }
}

export function sumTotals(list: ItemTotals[]): ItemTotals {
  const acc = list.reduce(
    (a, t) => ({
      materialSum: a.materialSum + t.materialSum,
      laborSum: a.laborSum + t.laborSum,
      expenseSum: a.expenseSum + t.expenseSum,
      costSum: a.costSum + t.costSum,
      total: a.total + t.total,
      profit: a.profit + t.profit,
      margin: 0,
    }),
    { materialSum: 0, laborSum: 0, expenseSum: 0, costSum: 0, total: 0, profit: 0, margin: 0 },
  )
  acc.margin = acc.total ? acc.profit / acc.total : 0
  return acc
}

export function sectionTotals(s: Section): ItemTotals {
  return sumTotals(s.items.map(itemTotals))
}

/* ------------------------------------------------------------------ */
/* 갑지 (요율 계산)                                                     */
/* ------------------------------------------------------------------ */

export interface CoverRow {
  no: number
  name: string
  unit: string
  qty: number
  price: number
  amount: number
}

export interface CoverSheet {
  rows: CoverRow[]
  /** 상세내역 재료비/노무비/경비 합계 */
  material: number
  labor: number
  expense: number
  generalAdmin: number
  safety: number
  profitFee: number
  /** 절삭 전 합계 */
  rawTotal: number
  /** 절삭 후 합계 (VAT 별도) */
  total: number
  vat: number
  totalWithVat: number
  /** 상세내역 원가 합계 */
  cost: number
  /** 매출이익 = 최종 합계 - 원가 */
  grossProfit: number
  margin: number
}

export function buildCover(sections: Section[], std: Standards): CoverSheet {
  const t = sumTotals(sections.map(sectionTotals))
  const { generalAdmin: gr, safety: sr, profit: pr, vat: vr, roundDownDigits } = std.rates

  const material = t.materialSum
  const labor = t.laborSum
  const expense = t.expenseSum
  const generalAdmin = round0((material + labor + expense) * gr)
  const safety = round0((material + labor) * sr)
  const profitFee = round0((labor + expense + generalAdmin) * pr)

  const rows: CoverRow[] = [
    { no: 1, name: '재료비', unit: 'LOT', qty: 1, price: material, amount: material },
    { no: 2, name: '노무비', unit: 'LOT', qty: 1, price: labor, amount: labor },
    { no: 3, name: '경비', unit: 'LOT', qty: 1, price: expense, amount: expense },
    {
      no: 4,
      name: `일반관리비{(1+2+3)*${pct(gr)}}`,
      unit: 'LOT',
      qty: 1,
      price: generalAdmin,
      amount: generalAdmin,
    },
    {
      no: 5,
      name: `안전 관리비{(1+2)*${pct(sr)}}`,
      unit: 'LOT',
      qty: 1,
      price: safety,
      amount: safety,
    },
    { no: 6, name: `이윤{(2+3+4)*${pct(pr)}}`, unit: 'LOT', qty: 1, price: profitFee, amount: profitFee },
  ]

  const rawTotal = rows.reduce((a, r) => a + r.amount, 0)
  const total = roundDown(rawTotal, roundDownDigits)
  const vat = round0(total * vr)
  const cost = t.costSum
  const grossProfit = total - cost

  return {
    rows,
    material,
    labor,
    expense,
    generalAdmin,
    safety,
    profitFee,
    rawTotal,
    total,
    vat,
    totalWithVat: total + vat,
    cost,
    grossProfit,
    margin: total ? grossProfit / total : 0,
  }
}

/* ------------------------------------------------------------------ */
/* 견적 기준 → 자동 항목 생성                                            */
/* ------------------------------------------------------------------ */

export function findCloudTier(tiers: CloudTier[], points: number): CloudTier | undefined {
  return tiers.find((t) => points >= t.from && (t.to === null || points <= t.to))
}

function ruleToItem(
  rule: UnitRule,
  qty: number,
  auto: AutoRuleId,
  note: string,
): LineItem {
  const item = emptyItem({
    name: rule.name,
    spec: rule.spec,
    unit: rule.unit,
    qty,
    cost: rule.cost,
    note,
    auto,
  })
  item[rule.kind] = rule.price
  return item
}

/** 견적 기준 + 입력값으로 자동 생성되는 항목들 */
export function buildAutoItems(input: QuoteInput, std: Standards): LineItem[] {
  const out: LineItem[] = []
  const { install, network, networkMeterPlusOne, networkMeterPlusOneNote } = std.construction

  if (install.meter.enabled && input.meterCount > 0) {
    out.push(ruleToItem(install.meter, input.meterCount, 'install-meter', ''))
  }
  if (install.ct.enabled && input.ctCount > 0) {
    out.push(ruleToItem(install.ct, input.ctCount, 'install-ct', ''))
  }
  if (network.meter.enabled && input.meterCount > 0) {
    const qty = input.meterCount + (networkMeterPlusOne ? 1 : 0)
    out.push(
      ruleToItem(network.meter, qty, 'network-meter', networkMeterPlusOne ? networkMeterPlusOneNote : ''),
    )
  }
  if (network.ct.enabled && input.ctCount > 0) {
    out.push(ruleToItem(network.ct, input.ctCount, 'network-ct', ''))
  }
  return out
}

export interface CloudResult {
  item: LineItem | null
  tier: CloudTier | undefined
  /** 협의 구간이라 금액 산출이 불가한 경우 */
  negotiable: boolean
}

export function buildCloudItem(input: QuoteInput, std: Standards): CloudResult {
  const tier = findCloudTier(std.cloud.tiers, input.points)
  if (!tier || input.points <= 0) return { item: null, tier, negotiable: false }

  const note = std.cloud.noteTemplate
    .replace('{years}', String(input.cloudYears))
    .replace('{points}', String(input.points))

  if (tier.negotiable) {
    return {
      item: emptyItem({
        name: '클라우드 사용료',
        spec: 'SaaS',
        unit: std.cloud.unit,
        qty: input.cloudYears,
        cost: 0,
        note: `${note} / 협의`,
        auto: 'cloud',
      }),
      tier,
      negotiable: true,
    }
  }

  const item = emptyItem({
    name: '클라우드 사용료',
    spec: 'SaaS',
    unit: std.cloud.unit,
    qty: input.cloudYears,
    cost: tier.cost,
    note,
    auto: 'cloud',
  })
  item[std.cloud.kind] = tier.price
  return { item, tier, negotiable: false }
}

/**
 * 견적 기준으로 자동 그룹(클라우드 / 시공)을 다시 만들어 기존 섹션에 반영한다.
 * `locked` 표시된 줄은 사용자가 직접 손댄 것으로 보고 그대로 둔다.
 */
export function applyStandards(sections: Section[], input: QuoteInput, std: Standards): Section[] {
  const construction = buildAutoItems(input, std)
  const cloud = buildCloudItem(input, std)

  const next = sections.map((s) => ({ ...s, items: [...s.items] }))

  const merge = (title: string, generated: LineItem[]) => {
    if (generated.length === 0) return
    let sec = next.find((s) => s.title === title)
    if (!sec) {
      sec = { id: uid('sec'), title, items: [] }
      next.push(sec)
    }
    const kept = sec.items.filter((i) => !i.auto || i.locked)
    // 자동 줄 중 사용자가 잠근 것과 같은 규칙은 재생성하지 않는다
    const lockedRules = new Set(kept.filter((i) => i.auto).map((i) => i.auto))
    const fresh = generated.filter((g) => !lockedRules.has(g.auto))
    sec.items = [...fresh, ...kept]
  }

  merge(std.construction.sectionTitle, construction)
  merge(std.cloud.sectionTitle, cloud.item ? [cloud.item] : [])

  return next.filter((s) => s.items.length > 0)
}

/* ------------------------------------------------------------------ */
/* 숫자 유틸                                                            */
/* ------------------------------------------------------------------ */

export function round0(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** 엑셀 ROUNDDOWN(n, digits) 과 동일 (digits 는 보통 음수) */
export function roundDown(n: number, digits: number): number {
  const f = Math.pow(10, -digits)
  return Math.floor(n / f) * f
}

export function pct(r: number): string {
  return `${+(r * 100).toFixed(4)}%`
}

export function fmt(n: number): string {
  if (!isFinite(n)) return '-'
  const r = Math.round(n)
  return r === 0 ? '-' : r.toLocaleString('ko-KR')
}

export function fmtPct(n: number): string {
  if (!isFinite(n) || n === 0) return '-'
  return `${(n * 100).toFixed(1)}%`
}

/* ------------------------------------------------------------------ */
/* 금액 한글 표기 (갑지 합계금액)                                        */
/* ------------------------------------------------------------------ */

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL_UNITS = ['', '십', '백', '천']
const BIG_UNITS = ['', '만', '억', '조', '경']

/** 34,500,000 → "삼천사백오십만" (엑셀 NUMBERSTRING(n,1) 과 동일한 표기) */
export function numberToHangul(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return '영'

  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 10000)
    n = Math.floor(n / 10000)
  }

  let out = ''
  for (let g = groups.length - 1; g >= 0; g--) {
    const group = groups[g]
    if (group === 0) continue
    let part = ''
    const s = String(group).padStart(4, '0')
    for (let i = 0; i < 4; i++) {
      const d = Number(s[i])
      if (d === 0) continue
      part += DIGITS[d] + SMALL_UNITS[3 - i]
    }
    out += part + BIG_UNITS[g]
  }
  return out
}

export function hangulAmountLine(total: number): string {
  return `합계금액 : 일금${numberToHangul(total)}원정(₩${Math.round(total).toLocaleString('ko-KR')})`
}

export function formatDateKR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${y}. ${m}. ${d}` : iso
}
