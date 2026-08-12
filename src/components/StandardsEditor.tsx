import type { CloudTier, CostKind, Standards, UnitRule } from '../types'
import { COST_KIND_LABEL } from '../types'
import { DEFAULT_STANDARDS } from '../defaults'
import { uid } from '../calc'

interface Props {
  standards: Standards
  onChange: (next: Standards) => void
}

const KINDS: CostKind[] = ['material', 'labor', 'expense']

export function StandardsEditor({ standards: std, onChange }: Props) {
  const patch = (p: Partial<Standards>) => onChange({ ...std, ...p })

  const { install, network } = std.construction
  const hasAnyCost =
    std.cloud.tiers.some((t) => t.cost > 0) ||
    [install.meter, install.ct, network.meter, network.ct].some((r) => r.cost > 0) ||
    std.catalog.some((c) => c.cost > 0)

  /* ---------------- 클라우드 구간 ---------------- */

  const setTier = (id: string, p: Partial<CloudTier>) =>
    patch({
      cloud: { ...std.cloud, tiers: std.cloud.tiers.map((t) => (t.id === id ? { ...t, ...p } : t)) },
    })

  const addTier = () => {
    const last = std.cloud.tiers[std.cloud.tiers.length - 1]
    const from = last ? (last.to ?? last.from) + 1 : 1
    const t: CloudTier = {
      id: uid('tier'),
      from,
      to: from + 9,
      label: `${from} ~ ${from + 9}P`,
      price: 0,
      cost: 0,
      negotiable: false,
    }
    patch({ cloud: { ...std.cloud, tiers: [...std.cloud.tiers, t] } })
  }

  const removeTier = (id: string) =>
    patch({ cloud: { ...std.cloud, tiers: std.cloud.tiers.filter((t) => t.id !== id) } })

  /* ---------------- 시공 단가 ---------------- */

  const setRule = (
    group: 'install' | 'network',
    which: 'meter' | 'ct',
    p: Partial<UnitRule>,
  ) =>
    patch({
      construction: {
        ...std.construction,
        [group]: { ...std.construction[group], [which]: { ...std.construction[group][which], ...p } },
      },
    })

  const ruleRow = (group: 'install' | 'network', which: 'meter' | 'ct', label: string) => {
    const r = std.construction[group][which]
    return (
      <tr key={`${group}-${which}`}>
        <td style={{ padding: '4px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</td>
        <td>
          <input type="text" value={r.name} onChange={(e) => setRule(group, which, { name: e.target.value })} />
        </td>
        <td style={{ width: 58 }}>
          <input type="text" value={r.unit} onChange={(e) => setRule(group, which, { unit: e.target.value })} />
        </td>
        <td className="num" style={{ width: 96 }}>
          <input
            type="number"
            value={r.price}
            onChange={(e) => setRule(group, which, { price: Number(e.target.value) || 0 })}
          />
        </td>
        <td className="num" style={{ width: 96 }}>
          <input
            type="number"
            value={r.cost}
            onChange={(e) => setRule(group, which, { cost: Number(e.target.value) || 0 })}
          />
        </td>
        <td style={{ width: 84 }}>
          <select value={r.kind} onChange={(e) => setRule(group, which, { kind: e.target.value as CostKind })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {COST_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </td>
        <td style={{ width: 44, textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={r.enabled}
            onChange={(e) => setRule(group, which, { enabled: e.target.checked })}
          />
        </td>
      </tr>
    )
  }

  /* ---------------- 요율 ---------------- */

  const rate = (k: 'generalAdmin' | 'safety' | 'profit' | 'vat', label: string, formula: string) => (
    <label className="f">
      <span>
        {label} <span className="muted" style={{ fontWeight: 400 }}>{formula}</span>
      </span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="number"
          step="0.1"
          value={+(std.rates[k] * 100).toFixed(4)}
          onChange={(e) =>
            patch({ rates: { ...std.rates, [k]: (Number(e.target.value) || 0) / 100 } })
          }
        />
        <span className="muted">%</span>
      </div>
    </label>
  )

  return (
    <>
      <div className="notice">
        여기서 바꾼 기준은 브라우저에 저장되고 이후 모든 견적에 적용됩니다. 상단의{' '}
        <b>기준·견적 저장</b>으로 JSON 파일을 받아 두면 다른 PC 에서 <b>불러오기</b>로 그대로 복원됩니다.
      </div>

      {!hasAnyCost && (
        <div className="notice" style={{ background: '#fdeeea', borderColor: '#f0b8ac', color: '#a03323' }}>
          <b>원가가 아직 입력되지 않았습니다.</b> 이 프로그램은 공개 주소로 배포되므로 원가를 소스에 넣지
          않습니다. 아래 표의 <b>원가</b> 칸을 채운 뒤 상단 <b>기준·견적 저장</b>으로 JSON 을 받아 사내에서만
          보관하세요. 원가가 0이면 매출이익 시트의 이익률이 100% 로 나옵니다.
        </div>
      )}

      {/* 1) 클라우드 */}
      <div className="card">
        <h3>1) 클라우드 비용 — Point 갯수 기준 (1년)</h3>
        <p className="hint">
          Point 수가 구간에 들어가면 해당 연간 금액 × 년수로 계상됩니다. <b>협의</b>에 체크한 구간은
          0원으로 넣고 직접 입력하도록 표시합니다.
        </p>
        <div className="scroll-x">
          <table className="grid-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>구간 표기</th>
                <th style={{ width: 62 }}>시작 P</th>
                <th style={{ width: 62 }}>끝 P</th>
                <th>연 판매가 (원)</th>
                <th>연 원가 (원)</th>
                <th style={{ width: 48 }}>협의</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {std.cloud.tiers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input type="text" value={t.label} onChange={(e) => setTier(t.id, { label: e.target.value })} />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      value={t.from}
                      onChange={(e) => setTier(t.id, { from: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      value={t.to ?? ''}
                      placeholder="∞"
                      onChange={(e) =>
                        setTier(t.id, { to: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      value={t.price}
                      disabled={t.negotiable}
                      onChange={(e) => setTier(t.id, { price: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      value={t.cost}
                      disabled={t.negotiable}
                      onChange={(e) => setTier(t.id, { cost: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={t.negotiable}
                      onChange={(e) => setTier(t.id, { negotiable: e.target.checked })}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn sm" onClick={() => removeTier(t.id)} title="삭제">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn sm" onClick={addTier}>
            + 구간 추가
          </button>
          <div className="spacer" />
          <label className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <span>계상 비목</span>
            <select
              value={std.cloud.kind}
              onChange={(e) => patch({ cloud: { ...std.cloud, kind: e.target.value as CostKind } })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {COST_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>
          연 <b>원가</b>는 기본값이 비어 있습니다. 매출이익을 보려면 실제 원가를 넣어 주세요.
        </div>
      </div>

      {/* 2) 시공비용 */}
      <div className="card">
        <h3>2) 시공비용 — 계측기 및 C/T 갯수 기준</h3>
        <div className="scroll-x">
          <table className="grid-table">
            <thead>
              <tr>
                <th style={{ width: 84 }}>구분</th>
                <th>견적서 품명</th>
                <th>단위</th>
                <th>판매가</th>
                <th>원가</th>
                <th>비목</th>
                <th>사용</th>
              </tr>
            </thead>
            <tbody>
              {ruleRow('install', 'meter', '설치비 · 계측기')}
              {ruleRow('install', 'ct', '설치비 · C/T')}
              {ruleRow('network', 'meter', '네트워크 · 계측기')}
              {ruleRow('network', 'ct', '네트워크 · C/T')}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={std.construction.networkMeterPlusOne}
              onChange={(e) =>
                patch({ construction: { ...std.construction, networkMeterPlusOne: e.target.checked } })
              }
            />
            계측기 네트워크 비용은 총갯수 <b>+1</b> (G/W 연결)
          </label>
        </div>
        <div className="grid c2" style={{ marginTop: 10 }}>
          <label className="f">
            <span>시공 그룹 제목</span>
            <input
              type="text"
              value={std.construction.sectionTitle}
              onChange={(e) =>
                patch({ construction: { ...std.construction, sectionTitle: e.target.value } })
              }
            />
          </label>
          <label className="f">
            <span>클라우드 그룹 제목</span>
            <input
              type="text"
              value={std.cloud.sectionTitle}
              onChange={(e) => patch({ cloud: { ...std.cloud, sectionTitle: e.target.value } })}
            />
          </label>
        </div>
      </div>

      {/* 3) 요율 */}
      <div className="card">
        <h3>3) 갑지 요율 · 절삭</h3>
        <div className="grid c2">
          {rate('generalAdmin', '일반관리비', '(재+노+경) ×')}
          {rate('safety', '안전 관리비', '(재+노) ×')}
          {rate('profit', '이윤', '(노+경+일반관리비) ×')}
          {rate('vat', '부가세', '합계 ×')}
        </div>
        <div className="grid c2" style={{ marginTop: 10 }}>
          <label className="f">
            <span>합계 절삭 단위</span>
            <select
              value={std.rates.roundDownDigits}
              onChange={(e) =>
                patch({ rates: { ...std.rates, roundDownDigits: Number(e.target.value) } })
              }
            >
              <option value={0}>절삭 없음</option>
              <option value={-3}>천원 미만 절삭</option>
              <option value={-4}>만원 미만 절삭</option>
              <option value={-5}>십만원 미만 절삭</option>
              <option value={-6}>백만원 미만 절삭</option>
            </select>
          </label>
          <label className="f">
            <span>클라우드 비고 문구</span>
            <input
              type="text"
              value={std.cloud.noteTemplate}
              onChange={(e) => patch({ cloud: { ...std.cloud, noteTemplate: e.target.value } })}
            />
          </label>
        </div>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          비고 문구에서 <code>{'{years}'}</code> 는 년수, <code>{'{points}'}</code> 는 Point 수로 바뀝니다.
        </p>
      </div>

      {/* 4) 공급자 */}
      <div className="card">
        <h3>4) 공급자 정보 (갑지 우측)</h3>
        <div className="grid c2">
          {(
            [
              ['company', '상호'],
              ['bizNo', '사업자등록번호'],
              ['ceo', '대표이사'],
              ['tel', 'TEL'],
              ['fax', 'FAX'],
              ['manager', '담당자'],
            ] as const
          ).map(([k, label]) => (
            <label className="f" key={k}>
              <span>{label}</span>
              <input
                type="text"
                value={std.supplier[k]}
                onChange={(e) => patch({ supplier: { ...std.supplier, [k]: e.target.value } })}
              />
            </label>
          ))}
        </div>
        <label className="f" style={{ marginTop: 10 }}>
          <span>주소</span>
          <input
            type="text"
            value={std.supplier.address}
            onChange={(e) => patch({ supplier: { ...std.supplier, address: e.target.value } })}
          />
        </label>
      </div>

      {/* 5) 특기사항 */}
      <div className="card">
        <h3>5) 특기사항</h3>
        <textarea
          rows={4}
          value={std.remarks.join('\n')}
          onChange={(e) => patch({ remarks: e.target.value.split('\n') })}
        />
        <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>한 줄에 한 항목씩 입력합니다.</p>
      </div>

      <div className="card">
        <h3>초기화</h3>
        <p className="hint">기준을 유호스트 기본값으로 되돌립니다. 작성 중인 견적 내용은 유지됩니다.</p>
        <button
          className="btn"
          onClick={() => {
            if (confirm('견적 기준을 기본값으로 되돌릴까요?')) onChange(structuredClone(DEFAULT_STANDARDS))
          }}
        >
          기본 기준으로 되돌리기
        </button>
      </div>
    </>
  )
}
