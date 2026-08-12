/** 비목 — 견적 상세내역의 원가 3분류 */
export type CostKind = 'material' | 'labor' | 'expense'

export const COST_KIND_LABEL: Record<CostKind, string> = {
  material: '재료비',
  labor: '노무비',
  expense: '경비',
}

/** 상세내역 한 줄 */
export interface LineItem {
  id: string
  name: string /** 품명 */
  spec: string /** 규격 */
  unit: string /** 단위 */
  qty: number /** 수량 */
  material: number /** 재료비 단가 */
  labor: number /** 노무비 단가 */
  expense: number /** 경비 단가 */
  cost: number /** 원가 단가 (매출이익 산출용) */
  note: string /** 비고 */
  /** 견적 기준에서 자동 생성된 줄이면 규칙 식별자. 수동 입력 줄은 undefined */
  auto?: AutoRuleId
  /** true 면 자동 재계산 시 이 줄을 덮어쓰지 않음 (사용자가 직접 수정) */
  locked?: boolean
}

/** 상세내역 그룹 (- 스마트분전반 제작, - 계측기 시공 …) */
export interface Section {
  id: string
  title: string
  items: LineItem[]
}

export type AutoRuleId =
  | 'cloud' /** 클라우드 비용 (Point 구간) */
  | 'material-meter' /** 재료비 - 계측기 */
  | 'material-module' /** 재료비 - 모듈 */
  | 'material-gateway' /** 재료비 - 게이트웨이 */
  | 'install-meter' /** 설치비 - 계측기 */
  | 'install-ct' /** 설치비 - C/T */
  | 'network-meter' /** 네트워크 비용 - 계측기 (총갯수 +1) */
  | 'network-ct' /** 네트워크 비용 - C/T */

/** 클라우드 요금 구간 (1년 기준) */
export interface CloudTier {
  id: string
  /** 구간 시작 Point (포함) */
  from: number
  /** 구간 끝 Point (포함). null 이면 상한 없음 = "100P 이상" */
  to: number | null
  /** 라벨 (표에 표시) */
  label: string
  /** 연간 판매가 (원) */
  price: number
  /** 연간 원가 (원) */
  cost: number
  /** true 면 금액 산출 불가 → "협의" 로 표시 */
  negotiable: boolean
}

/** 계측기 / C/T 단가 규칙 한 줄 */
export interface UnitRule {
  /** 견적서에 찍히는 품명 */
  name: string
  spec: string
  unit: string
  /** 판매가 (원) */
  price: number
  /** 원가 (원) */
  cost: number
  /** 어느 비목으로 계상할지 */
  kind: CostKind
  /** 이 규칙을 사용할지 */
  enabled: boolean
}

/** 견적 기준 — 전부 사용자가 수정 가능 */
export interface Standards {
  /** 1) 클라우드 비용: Point 갯수로 산출 (1년 기준) */
  cloud: {
    sectionTitle: string
    tiers: CloudTier[]
    kind: CostKind
    unit: string
    /** 비고에 붙는 문구 (예: "n년기준") */
    noteTemplate: string
  }
  /**
   * 2) 자재: 계측기 · 모듈 · 게이트웨이는 재료비로 계상한다.
   * 설치비는 여기 섞지 않고 아래 construction 에서 따로 계산한다.
   */
  materials: {
    sectionTitle: string
    meter: UnitRule
    module: UnitRule
    gateway: UnitRule
  }
  /** 3) 시공비용: 계측기 및 C/T 갯수 기준 */
  construction: {
    sectionTitle: string
    install: { meter: UnitRule; ct: UnitRule }
    network: { meter: UnitRule; ct: UnitRule }
    /** 계측기 네트워크 비용은 총갯수 +1 (G/W 연결) */
    networkMeterPlusOne: boolean
    networkMeterPlusOneNote: string
  }
  /** 3) 갑지 요율 */
  rates: {
    /** 일반관리비 = (재료비+노무비+경비) × r */
    generalAdmin: number
    /** 안전관리비 = (재료비+노무비) × r */
    safety: number
    /** 이윤 = (노무비+경비+일반관리비) × r */
    profit: number
    /** 부가세율 */
    vat: number
    /**
     * 합계 절삭 자릿수. ROUNDDOWN(합계, roundDownDigits) 와 동일.
     * -5 = 십만원 미만 절삭, -4 = 만원 미만 절삭
     */
    roundDownDigits: number
  }
  /** 공급자(자사) 정보 — 갑지 우측 */
  supplier: {
    company: string
    bizNo: string
    ceo: string
    address: string
    tel: string
    fax: string
    manager: string
  }
  /** 갑지 특기사항 */
  remarks: string[]
  /** 자재/노무 단가 카탈로그 — 항목 추가 시 빠른 입력용 */
  catalog: CatalogEntry[]
}

export interface CatalogEntry {
  id: string
  category: string
  name: string
  spec: string
  unit: string
  material: number
  labor: number
  expense: number
  cost: number
}

/** 견적 1건의 입력값 */
export interface QuoteInput {
  /** 수신 — 업체명 */
  customer: string
  /** 참조 */
  attn: string
  /** 제목 */
  subject: string
  /** 날짜 (yyyy-mm-dd) */
  date: string
  /** 유효기간 */
  validity: string
  /** 지불조건 */
  payment: string
  /** Point 갯수 */
  points: number
  /** 계측기 갯수 */
  meterCount: number
  /** C/T 갯수 */
  ctCount: number
  /** 모듈 갯수 */
  moduleCount: number
  /** 게이트웨이 갯수 */
  gatewayCount: number
  /** 클라우드 이용 년수 */
  cloudYears: number
}

export interface QuoteDoc {
  input: QuoteInput
  sections: Section[]
}

/** 저장/불러오기 파일 포맷 */
export interface ProjectFile {
  version: 1
  standards: Standards
  doc: QuoteDoc
}
