import type { QuoteInput, Standards } from '../types'
import { COST_KIND_LABEL } from '../types'
import { findCloudTier, fmt } from '../calc'

interface Props {
  input: QuoteInput
  standards: Standards
  onChange: (next: QuoteInput) => void
  onApply: () => void
}

export function QuoteForm({ input, standards, onChange, onApply }: Props) {
  const set = <K extends keyof QuoteInput>(k: K, v: QuoteInput[K]) => onChange({ ...input, [k]: v })
  const num = (v: string) => (v === '' ? 0 : Math.max(0, Number(v) || 0))

  const tier = findCloudTier(standards.cloud.tiers, input.points)
  const { install, network, networkMeterPlusOne } = standards.construction
  const materials = standards.materials
  const netQty = input.meterCount > 0 ? input.meterCount + (networkMeterPlusOne ? 1 : 0) : 0

  const materialTotal =
    (materials.meter.enabled ? materials.meter.price * input.meterCount : 0) +
    (materials.module.enabled ? materials.module.price * input.moduleCount : 0) +
    (materials.gateway.enabled ? materials.gateway.price * input.gatewayCount : 0)

  const cloudTotal = tier && !tier.negotiable ? tier.price * input.cloudYears : 0
  const installTotal =
    (install.meter.enabled ? install.meter.price * input.meterCount : 0) +
    (install.ct.enabled ? install.ct.price * input.ctCount : 0)
  const networkTotal =
    (network.meter.enabled ? network.meter.price * netQty : 0) +
    (network.ct.enabled ? network.ct.price * input.ctCount : 0)

  return (
    <>
      <div className="card">
        <h3>1. 견적 대상</h3>
        <p className="hint">업체명과 제목만 넣으면 갑지가 채워집니다.</p>
        <div className="grid c2">
          <label className="f">
            <span className="req">수신 (업체명)</span>
            <input
              type="text"
              value={input.customer}
              placeholder="예: 나인랩스"
              onChange={(e) => set('customer', e.target.value)}
            />
          </label>
          <label className="f">
            <span>참조</span>
            <input type="text" value={input.attn} onChange={(e) => set('attn', e.target.value)} />
          </label>
        </div>
        <div className="grid" style={{ marginTop: 10 }}>
          <label className="f">
            <span className="req">제목</span>
            <input
              type="text"
              value={input.subject}
              placeholder="예: 나인랩스 ESG 사업 스마트분전반 시공 견적서"
              onChange={(e) => set('subject', e.target.value)}
            />
          </label>
        </div>
        <div className="grid c3" style={{ marginTop: 10 }}>
          <label className="f">
            <span>날짜</span>
            <input type="date" value={input.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className="f">
            <span>유효기간</span>
            <input type="text" value={input.validity} onChange={(e) => set('validity', e.target.value)} />
          </label>
          <label className="f">
            <span>지불조건</span>
            <input type="text" value={input.payment} onChange={(e) => set('payment', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>
          2. 견적 기준 입력값 <span className="tag auto">자동 산출</span>
        </h3>
        <p className="hint">
          Point 갯수 → 클라우드 비용, 계측기·C/T 갯수 → 설치비·네트워크 비용이 상세내역에 자동으로 들어갑니다.
        </p>
        <div className="grid c4">
          <label className="f">
            <span>Point 갯수</span>
            <input
              type="number"
              min={0}
              value={input.points}
              onChange={(e) => set('points', num(e.target.value))}
            />
          </label>
          <label className="f">
            <span>클라우드 년수</span>
            <input
              type="number"
              min={1}
              value={input.cloudYears}
              onChange={(e) => set('cloudYears', Math.max(1, num(e.target.value)))}
            />
          </label>
          <label className="f">
            <span>계측기 갯수</span>
            <input
              type="number"
              min={0}
              value={input.meterCount}
              onChange={(e) => set('meterCount', num(e.target.value))}
            />
          </label>
          <label className="f">
            <span>C/T 갯수</span>
            <input
              type="number"
              min={0}
              value={input.ctCount}
              onChange={(e) => set('ctCount', num(e.target.value))}
            />
          </label>
          <label className="f">
            <span>모듈 갯수</span>
            <input
              type="number"
              min={0}
              value={input.moduleCount}
              onChange={(e) => set('moduleCount', num(e.target.value))}
            />
          </label>
          <label className="f">
            <span>게이트웨이 갯수</span>
            <input
              type="number"
              min={0}
              value={input.gatewayCount}
              onChange={(e) => set('gatewayCount', num(e.target.value))}
            />
          </label>
        </div>

        <table className="grid-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ width: '34%' }}>항목</th>
              <th>적용 기준</th>
              <th style={{ width: '20%' }}>수량</th>
              <th style={{ width: '24%' }}>판매가 합계</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '5px 6px' }}>
                자재비 <span className="tag">재료비</span>
              </td>
              <td style={{ padding: '5px 6px' }}>
                계측기 {fmt(materials.meter.price)} · 모듈 {fmt(materials.module.price)} · G/W{' '}
                {fmt(materials.gateway.price)}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                계측기 {input.meterCount} · 모듈 {input.moduleCount} · G/W {input.gatewayCount}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'right' }}>{fmt(materialTotal)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px 6px' }}>클라우드 비용</td>
              <td style={{ padding: '5px 6px' }}>
                {input.points > 0 ? (
                  tier ? (
                    tier.negotiable ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{tier.label} — 협의</span>
                    ) : (
                      `${tier.label} · 연 ${fmt(tier.price)}원`
                    )
                  ) : (
                    <span className="muted">해당 구간 없음</span>
                  )
                ) : (
                  <span className="muted">Point 미입력</span>
                )}
              </td>
              <td className="c" style={{ padding: '5px 6px', textAlign: 'center' }}>
                {input.points > 0 ? `${input.cloudYears}년` : '-'}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                {tier?.negotiable ? '협의' : fmt(cloudTotal)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '5px 6px' }}>
                설치비 <span className="tag auto">{COST_KIND_LABEL[install.meter.kind]}</span>
              </td>
              <td style={{ padding: '5px 6px' }}>
                계측기 {fmt(install.meter.price)} / C/T {fmt(install.ct.price)}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                계측기 {input.meterCount} · C/T {input.ctCount}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'right' }}>{fmt(installTotal)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px 6px' }}>네트워크 비용</td>
              <td style={{ padding: '5px 6px' }}>
                계측기 {fmt(network.meter.price)}
                {networkMeterPlusOne && <span className="muted"> · 총갯수 +1 (G/W)</span>}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'center' }}>계측기 {netQty}</td>
              <td style={{ padding: '5px 6px', textAlign: 'right' }}>{fmt(networkTotal)}</td>
            </tr>
          </tbody>
        </table>

        {tier?.negotiable && (
          <div className="notice" style={{ marginTop: 10 }}>
            Point가 기준표의 최대 구간을 넘었습니다 (<b>{tier.label}</b>). 금액은 <b>협의</b> 항목으로
            들어가며 0원으로 계상되니, 상세 항목 화면에서 직접 금액을 입력하세요.
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={onApply}>
            견적 기준 다시 적용
          </button>
          <span className="muted">
            입력값을 바꾸면 자동으로 반영됩니다. 직접 수정한(🔒) 줄은 덮어쓰지 않습니다.
          </span>
        </div>
      </div>
    </>
  )
}
