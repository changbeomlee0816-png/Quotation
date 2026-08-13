import { useEffect, useMemo, useRef, useState } from 'react'
import { QuoteForm } from './components/QuoteForm'
import { StandardsEditor } from './components/StandardsEditor'
import { ItemsEditor } from './components/ItemsEditor'
import { Preview } from './components/Preview'
import { applyStandards, buildCover, fmt, fmtPct } from './calc'
import { buildPages } from './pages'
import { buildWorkbook, downloadWorkbook } from './export/excel'
import { exportPdf } from './export/pdf'
import {
  exportProject,
  importProject,
  useDoc,
  useLibrary,
  usePersistentState,
  useStandards,
} from './store'
import { DEFAULT_INPUT, nextQuoteNo, todayISO } from './defaults'
import { QuoteLibrary } from './components/QuoteLibrary'
import type { QuoteInput, SavedQuote, Section } from './types'

type Tab = 'quote' | 'items' | 'standards'

const KEY_SIDEBAR_W = 'youhost.ui.sidebarWidth.v1'
const DEFAULT_SIDEBAR_W = 620
const MIN_SIDEBAR_W = 380

export default function App() {
  const [standards, setStandards] = useStandards()
  const [doc, setDoc] = useDoc()
  const [tab, setTab] = useState<Tab>('quote')
  const [sidebarW, setSidebarW] = usePersistentState<number>(KEY_SIDEBAR_W, DEFAULT_SIDEBAR_W)
  const [resizing, setResizing] = useState(false)
  const [zoom, setZoom] = useState(0.62)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pages = useMemo(() => buildPages(doc.sections), [doc.sections])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  /** 사용자가 직접 체크를 건드린 페이지 — 기본값(매출이익 제외)을 다시 씌우지 않는다 */
  const touchedRef = useRef<Set<string>>(new Set())

  // 매출이익 페이지는 내부 자료라 기본으로 PDF 에서 뺀다
  useEffect(() => {
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const p of pages) {
        if (p.kind === 'profit' && !prev.has(p.id) && !touchedRef.current.has(p.id)) next.add(p.id)
      }
      return next
    })
  }, [pages])

  const selected = useMemo(
    () => new Set(pages.filter((p) => !excluded.has(p.id)).map((p) => p.id)),
    [pages, excluded],
  )

  const cover = useMemo(
    () => buildCover(doc.sections, standards, doc.input),
    [doc.sections, standards, doc.input],
  )

  /* ---------------- 견적 이력 ---------------- */

  const library = useLibrary()
  const [libOpen, setLibOpen] = useState(false)
  const [savedTick, setSavedTick] = useState<string | null>(null)

  const saveQuote = () => {
    if (!doc.input.quoteNo.trim()) {
      alert('견적번호를 입력하세요.')
      return
    }
    library.save(doc, cover.total)
    setSavedTick(new Date().toLocaleTimeString('ko-KR'))
    setTimeout(() => setSavedTick(null), 2500)
  }

  const newQuote = () => {
    if (!confirm('새 견적을 시작합니다. 저장하지 않은 내용은 사라집니다.')) return
    setDoc({
      input: { ...DEFAULT_INPUT, quoteNo: nextQuoteNo(library.list.map((q) => q.quoteNo)) },
      sections: [],
    })
    lastApplied.current = ''
  }

  const openSaved = (q: SavedQuote) => {
    setDoc(structuredClone(q.doc))
    lastApplied.current = [
      q.doc.input.points,
      q.doc.input.meterCount,
      q.doc.input.ctCount,
      q.doc.input.moduleCount,
      q.doc.input.gatewayCount,
      q.doc.input.cloudYears,
    ].join('|')
    setLibOpen(false)
  }

  const duplicateSaved = (q: SavedQuote) => {
    const copy = structuredClone(q.doc)
    copy.input.quoteNo = nextQuoteNo(library.list.map((x) => x.quoteNo))
    copy.input.date = todayISO()
    openSaved({ ...q, doc: copy })
  }

  /* ---------------- 견적 기준 자동 적용 ---------------- */

  const { points, meterCount, ctCount, moduleCount, gatewayCount, cloudYears } = doc.input
  const applyKey = [points, meterCount, ctCount, moduleCount, gatewayCount, cloudYears].join('|')
  const lastApplied = useRef<string>('')

  useEffect(() => {
    if (lastApplied.current === applyKey) return
    lastApplied.current = applyKey
    setDoc((d) => ({ ...d, sections: applyStandards(d.sections, d.input, standards) }))
    // standards 는 의도적으로 의존성에서 뺐다 — 기준을 고칠 때마다 항목이 리셋되면 곤란하다.
    // 기준 변경 후에는 "견적 기준 다시 적용" 버튼을 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyKey])

  /* ---------------- 편집 영역 폭 조절 ---------------- */

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    document.body.classList.add('resizing')
    const startX = e.clientX
    const startW = sidebarW
    const onMove = (ev: MouseEvent) => {
      const max = Math.max(MIN_SIDEBAR_W, window.innerWidth - 320)
      setSidebarW(Math.min(max, Math.max(MIN_SIDEBAR_W, startW + ev.clientX - startX)))
    }
    const onUp = () => {
      setResizing(false)
      document.body.classList.remove('resizing')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const setInput = (input: QuoteInput) => setDoc((d) => ({ ...d, input }))
  const setSections = (sections: Section[]) => setDoc((d) => ({ ...d, sections }))
  const reapply = () =>
    setDoc((d) => ({ ...d, sections: applyStandards(d.sections, d.input, standards) }))

  /* ---------------- 파일명 ---------------- */

  const baseName = () => {
    const c = doc.input.customer.trim() || '견적서'
    return `${c}_견적서_${doc.input.date.replace(/-/g, '')}`
  }

  /* ---------------- 내보내기 ---------------- */

  const onExcel = async () => {
    try {
      setBusy('엑셀 파일을 만드는 중…')
      const buf = await buildWorkbook(doc.input, standards, doc.sections)
      downloadWorkbook(buf, `${baseName()}.xlsx`)
    } catch (e) {
      alert(`엑셀 생성 실패: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const onPdf = async () => {
    const ids = pages.filter((p) => selected.has(p.id)).map((p) => p.id)
    if (ids.length === 0) {
      alert('PDF 에 넣을 페이지를 한 장 이상 선택하세요.')
      return
    }
    try {
      setBusy('PDF 를 만드는 중…')
      await exportPdf(ids, `${baseName()}.pdf`, (done, total) =>
        setBusy(`PDF 를 만드는 중… (${done}/${total})`),
      )
    } catch (e) {
      alert(`PDF 생성 실패: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const onImport = async (f: File) => {
    try {
      const p = await importProject(f)
      setStandards(p.standards)
      setDoc(p.doc)
      alert('불러왔습니다.')
    } catch (e) {
      alert(`불러오기 실패: ${(e as Error).message}`)
    }
  }

  const togglePage = (id: string) => {
    touchedRef.current.add(id)
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setAllPages = (on: boolean) => {
    pages.forEach((p) => touchedRef.current.add(p.id))
    setExcluded(on ? new Set() : new Set(pages.map((p) => p.id)))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">₩</span>
          <div>
            <h1>유호스트 견적 제작</h1>
            <span className="sub">견적 기준 기반 자동 산출 · Excel / PDF</span>
          </div>
        </div>

        <div className="doc-chip" title="작업 중인 견적">
          <span className="no">{doc.input.quoteNo || '견적번호 없음'}</span>
          <span className="who">{doc.input.customer || '업체명 미입력'}</span>
        </div>

        <div className="spacer" />

        {savedTick && <span className="saved-tick">저장됨 {savedTick}</span>}

        <div className="file-actions">
          <button className="btn ghost" onClick={() => setLibOpen(true)}>
            견적 이력 <span className="count">{library.list.length}</span>
          </button>
          <button className="btn accent" onClick={saveQuote}>
            견적 저장
          </button>
          <span className="vr" />
          <button
            className="btn ghost"
            onClick={() => exportProject(standards, doc, `${baseName()}.json`)}
            title="견적 기준과 현재 견적을 JSON 파일로 내보냅니다"
          >
            내보내기
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            불러오기
          </button>
          <button className="btn ghost" onClick={newQuote}>
            새 견적
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="main">
        <div className="sidebar" style={{ width: sidebarW }}>
          <div className="tabs">
            <button className={tab === 'quote' ? 'on' : ''} onClick={() => setTab('quote')}>
              견적 정보
            </button>
            <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>
              상세 항목
            </button>
            <button className={tab === 'standards' ? 'on' : ''} onClick={() => setTab('standards')}>
              견적 기준
            </button>
          </div>
          <div className="tab-body">
            {tab === 'quote' && (
              <QuoteForm input={doc.input} standards={standards} onChange={setInput} onApply={reapply} />
            )}
            {tab === 'items' && (
              <ItemsEditor sections={doc.sections} standards={standards} onChange={setSections} />
            )}
            {tab === 'standards' && <StandardsEditor standards={standards} onChange={setStandards} />}
          </div>
        </div>

        <div
          className={`splitter${resizing ? ' on' : ''}`}
          onMouseDown={startResize}
          onDoubleClick={() => setSidebarW(DEFAULT_SIDEBAR_W)}
          title="드래그해서 편집 영역 폭 조절 (더블클릭하면 기본값)"
        />

        <div className="viewer">
          <div className="viewer-bar">
            <button className="btn green" onClick={onExcel} disabled={!!busy}>
              엑셀 다운로드
            </button>
            <button className="btn primary" onClick={onPdf} disabled={!!busy}>
              PDF 다운로드 ({selected.size}장)
            </button>

            <div className="page-select">
              <span style={{ fontSize: 11.5, opacity: 0.8 }}>PDF 페이지:</span>
              {pages.map((p) => (
                <label key={p.id} className={selected.has(p.id) ? 'on' : ''}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => togglePage(p.id)}
                  />
                  {p.kind === 'cover' ? '갑지' : p.label}
                </label>
              ))}
              <button className="btn sm ghost" onClick={() => setAllPages(true)}>
                전체
              </button>
              <button className="btn sm ghost" onClick={() => setAllPages(false)}>
                해제
              </button>
            </div>

            <div className="spacer" />

            <div className="zoom">
              <button className="btn sm ghost" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.08).toFixed(2)))}>
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button className="btn sm ghost" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.08).toFixed(2)))}>
                +
              </button>
            </div>

            <div className="sum-strip">
              {cover.discount > 0 && (
                <span>
                  <span className="k">할인 </span>
                  <span className="v" style={{ color: '#ffb3a7' }}>−{fmt(cover.discount)}</span>
                </span>
              )}
              <span>
                <span className="k">합계 </span>
                <span className="v big">{fmt(cover.total)}</span>
              </span>
              <span>
                <span className="k">VAT 포함 </span>
                <span className="v">{fmt(cover.totalWithVat)}</span>
              </span>
              <span>
                <span className="k">이익률 </span>
                <span className="v">{fmtPct(cover.margin)}</span>
              </span>
            </div>
          </div>

          <div className="viewer-scroll">
            <Preview
              pages={pages}
              selected={selected}
              input={doc.input}
              standards={standards}
              sections={doc.sections}
              zoom={zoom}
            />
          </div>
        </div>
      </div>

      {libOpen && (
        <QuoteLibrary
          list={library.list}
          currentNo={doc.input.quoteNo}
          onOpen={openSaved}
          onDuplicate={duplicateSaved}
          onRemove={library.remove}
          onClose={() => setLibOpen(false)}
        />
      )}

      {busy && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontWeight: 700,
            zIndex: 100,
          }}
        >
          {busy}
        </div>
      )}
    </div>
  )
}
