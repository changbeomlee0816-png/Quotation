import type { CatalogEntry, CloudTier, QuoteInput, Standards } from './types'

const 만 = 10_000

/**
 * ─────────────────────────────────────────────────────────────────────
 * 원가(cost)는 이 파일에 넣지 않는다.
 *
 * 이 저장소는 공개(public)이고 빌드 결과도 공개 주소로 배포되므로,
 * 소스에 원가를 적으면 마진 구조가 그대로 노출된다.
 * 따라서 모든 원가 기본값은 0 이고, 실제 원가는
 *   1) 견적 기준 화면에서 직접 입력한 뒤
 *   2) 상단 "기준·견적 저장" 으로 JSON 을 받아 사내에서만 보관하고
 *   3) 다른 PC 에서는 "불러오기" 로 복원
 * 하는 방식으로 쓴다. 입력한 값은 각자 브라우저에도 자동 저장된다.
 *
 * 판매가는 고객에게 제시하는 금액이라 기본값으로 넣어 둔다.
 * ─────────────────────────────────────────────────────────────────────
 */
const NO_COST = 0

function tier(from: number, to: number | null, label: string, priceMan: number): CloudTier {
  return {
    id: `cloud-${from}`,
    from,
    to,
    label,
    price: priceMan * 만,
    cost: NO_COST,
    negotiable: false,
  }
}

export const DEFAULT_CLOUD_TIERS: CloudTier[] = [
  tier(1, 10, '10P', 50),
  tier(11, 20, '11 ~ 20P', 100),
  tier(21, 30, '21 ~ 30P', 150),
  tier(31, 40, '31 ~ 40P', 200),
  tier(41, 50, '41 ~ 50P', 250),
  tier(51, 60, '51 ~ 60P', 300),
  tier(61, 70, '61 ~ 70P', 350),
  tier(71, 80, '71 ~ 80P', 400),
  tier(81, 90, '81 ~ 90P', 450),
  tier(91, 100, '91 ~ 100P', 500),
  { id: 'cloud-101', from: 101, to: null, label: '100P 이상', price: 0, cost: 0, negotiable: true },
]

export const DEFAULT_STANDARDS: Standards = {
  cloud: {
    sectionTitle: '- 클라우드 비용',
    tiers: DEFAULT_CLOUD_TIERS,
    kind: 'material',
    unit: '식',
    noteTemplate: '{years}년기준 / {points}P',
  },
  construction: {
    sectionTitle: '- 계측기 시공',
    install: {
      meter: {
        name: '설치비 (계측기)',
        spec: '계측기 설치',
        unit: 'EA',
        price: 30 * 만,
        cost: NO_COST,
        kind: 'labor',
        enabled: true,
      },
      ct: {
        name: '설치비 (C/T)',
        spec: 'C/T 설치',
        unit: 'EA',
        price: 2 * 만,
        cost: NO_COST,
        kind: 'labor',
        enabled: true,
      },
    },
    network: {
      meter: {
        name: '네트워크 비용 (계측기)',
        spec: '계측기 네트워크 구성',
        unit: 'EA',
        price: 35 * 만,
        cost: NO_COST,
        kind: 'expense',
        enabled: true,
      },
      ct: {
        name: '네트워크 비용 (C/T)',
        spec: 'C/T 네트워크 구성',
        unit: 'EA',
        price: 0,
        cost: 0,
        kind: 'expense',
        enabled: false,
      },
    },
    networkMeterPlusOne: true,
    networkMeterPlusOneNote: '총갯수 +1 (G/W 연결)',
  },
  rates: {
    generalAdmin: 0.06,
    safety: 0.03,
    profit: 0.1,
    vat: 0.1,
    roundDownDigits: -5,
  },
  supplier: {
    company: '㈜ 유호스트',
    bizNo: '119 - 81 - 85772',
    ceo: '이   은   재',
    address: '서울시 서초구 남부순환로 2495 원림빌딩 6층',
    tel: '02 - 523 - 3975',
    fax: '02 - 523 - 3971',
    manager: '이창범 대리 (lcb0816@youhost.co.kr)',
  },
  remarks: ['1) VAT 별도, 만단위 절삭', '2) 클라우드 이용료는 1년 단위 계산'],
  catalog: [],
}

/** 기준 견적서(스마트분전반 ESG)에서 추출한 단가 카탈로그 */
const RAW_CATALOG: Omit<CatalogEntry, 'id' | 'cost'>[] = [
  // 스마트분전반 제작
  { category: '분전반', name: '외함', spec: '노출(ST1.6t)-P W750xH1000', unit: '면', material: 364900, labor: 0, expense: 0 },
  { category: '분전반', name: '부스편', spec: '부스편', unit: 'SET', material: 110000, labor: 0, expense: 0 },
  { category: '분전반', name: 'Main 차단기', spec: 'MCCB 250AF 3P 460V 37KA', unit: 'EA', material: 256500, labor: 0, expense: 0 },
  { category: '분전반', name: '부스바', spec: '250AF 3P 300', unit: 'SET', material: 53200, labor: 0, expense: 0 },
  { category: '분전반', name: '누전차단기(ELB)', spec: 'ELCB 125AF 3P 460V 37KA', unit: 'EA', material: 188900, labor: 0, expense: 0 },
  { category: '분전반', name: '누전차단기(ELB)', spec: 'ELCB 50AF 3P 460V 18KA', unit: 'EA', material: 136800, labor: 0, expense: 0 },
  { category: '분전반', name: '연결커넥터', spec: '125AF 3P', unit: 'EA', material: 15600, labor: 0, expense: 0 },
  { category: '분전반', name: '연결커넥터', spec: '100AF 이하 3P', unit: 'EA', material: 15600, labor: 0, expense: 0 },
  { category: '분전반', name: '접지', spec: '11P', unit: 'EA', material: 16800, labor: 0, expense: 0 },
  { category: '분전반', name: '잡자재', spec: '애자,Fuse,S/W,PBL,TB,케이블, 볼트류 등', unit: '식', material: 51300, labor: 0, expense: 0 },
  { category: '분전반', name: '노무비', spec: '판넬조립비용', unit: '인', material: 0, labor: 300000, expense: 0 },

  // 계측 기기
  { category: '계측기', name: 'MAIN METER/WHM', spec: 'ACCURA 2300', unit: 'EA', material: 600000, labor: 0, expense: 0 },
  { category: '계측기', name: 'Main METER', spec: 'ACCURA 2300S', unit: 'EA', material: 600000, labor: 0, expense: 0 },
  { category: '계측기', name: '분기 DM/WHM', spec: 'ACCURA 2350-3P-60A-75', unit: 'EA', material: 200000, labor: 0, expense: 0 },
  { category: '계측기', name: '분기 DM/WHM', spec: 'ACCURA 2350-3P-125A-90', unit: 'EA', material: 200000, labor: 0, expense: 0 },
  { category: '계측기', name: '원격제어 모듈', spec: 'DO모듈', unit: 'EA', material: 200000, labor: 0, expense: 0 },

  // 노무 (표준품셈 노임단가)
  { category: '노무', name: '내선전공', spec: '-', unit: '인', material: 0, labor: 273676, expense: 0 },
  { category: '노무', name: '저압케이블공', spec: '-', unit: '인', material: 0, labor: 304156, expense: 0 },
  { category: '노무', name: '신호수', spec: '-', unit: '인', material: 0, labor: 150000, expense: 0 },

  // 시공 자재
  { category: '시공', name: 'CABLE&WIRE', spec: 'F-CV 95SQ×1C', unit: 'MT', material: 21852, labor: 0, expense: 0 },
  { category: '시공', name: 'CABLE&WIRE', spec: 'F-GV 50SQ', unit: 'MT', material: 14000, labor: 0, expense: 0 },
  { category: '시공', name: 'CABLE&WIRE', spec: 'KIV 95SQ', unit: 'MT', material: 20000, labor: 0, expense: 0 },
  { category: '시공', name: '조작케이블', spec: 'KIV 1.5SQ', unit: '롤', material: 65000, labor: 0, expense: 0 },
  { category: '시공', name: 'MCCB', spec: 'ABS15A 4P', unit: 'EA', material: 48000, labor: 0, expense: 0 },
  { category: '시공', name: 'MCCB', spec: 'ABS250A 3P', unit: 'EA', material: 154000, labor: 0, expense: 0 },
  { category: '시공', name: '동관단자', spec: '95SQ 1HOLE', unit: '대', material: 2826, labor: 0, expense: 0 },
  { category: '시공', name: '동관단자', spec: '50SQ 1HOLE', unit: '대', material: 1290, labor: 0, expense: 0 },
  { category: '시공', name: 'CABLE TRAY(COVER포함)', spec: 'W200×H100', unit: 'MT', material: 25000, labor: 0, expense: 0 },
  { category: '시공', name: 'CABLE TRAY(COVER포함) V/V O', spec: 'W200×H100', unit: 'EA', material: 28900, labor: 0, expense: 0 },
  { category: '시공', name: '퓨즈', spec: '-', unit: 'EA', material: 3000, labor: 0, expense: 0 },
  { category: '시공', name: '장비비(렌탈)', spec: '-', unit: '대', material: 0, labor: 0, expense: 150000 },

  // FEMS
  { category: 'FEMS', name: '소프트웨어 라이선스', spec: '-', unit: '식', material: 6000000, labor: 0, expense: 0 },
  { category: 'FEMS', name: '게이트웨이', spec: 'NDAS', unit: '식', material: 3500000, labor: 0, expense: 0 },
  { category: 'FEMS', name: '미니PC', spec: '-', unit: '식', material: 500000, labor: 0, expense: 0 },
  { category: 'FEMS', name: '거치대', spec: '에이그 거치대', unit: '식', material: 228000, labor: 0, expense: 0 },
  { category: 'FEMS', name: '모니터', spec: 'LG TV 163cm(65인치) 4K LED 65UQ7050', unit: '식', material: 790890, labor: 0, expense: 0 },
  { category: 'FEMS', name: 'FEMS 연동/구성/설치/매핑', spec: '-', unit: '식', material: 0, labor: 325000, expense: 0 },
  { category: 'FEMS', name: '클라우드 연동', spec: '-', unit: '식', material: 0, labor: 1056110, expense: 0 },
]

// 원가는 사용자가 견적 기준 화면에서 채운다 (위 주석 참고)
DEFAULT_STANDARDS.catalog = RAW_CATALOG.map((c, i) => ({ ...c, id: `cat-${i}`, cost: NO_COST }))

export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const DEFAULT_INPUT: QuoteInput = {
  customer: '',
  attn: '',
  subject: '',
  date: todayISO(),
  validity: '견적후 1달',
  payment: '계약서 명기',
  points: 0,
  meterCount: 0,
  ctCount: 0,
  cloudYears: 1,
}
