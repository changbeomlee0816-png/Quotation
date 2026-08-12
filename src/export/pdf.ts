import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

const A4_W = 210
const A4_H = 297

/**
 * 미리보기 DOM(.a4-page[data-page-id]) 중 선택된 페이지만 PDF 로 묶는다.
 * 한글 폰트 임베딩 문제를 피하려고 각 페이지를 캔버스로 렌더링해 이미지로 넣는다.
 *
 * 주의: 미리보기는 CSS transform: scale() 로 축소해 두는데, html2canvas 는
 * 변형된 조상 아래에서 글자 폭을 잘못 재서 글씨가 겹친다. 캡처 동안에는
 * 배율을 1 로 되돌리고 화면용 장식(페이지 배지, 흐림 처리)을 잠시 끈다.
 */
export async function exportPdf(
  pageIds: string[],
  filename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (pageIds.length === 0) throw new Error('선택된 페이지가 없습니다.')

  const wrap = document.querySelector<HTMLElement>('.page-wrap')
  const prevTransform = wrap?.style.transform ?? ''
  if (wrap) wrap.style.transform = 'none'
  document.body.classList.add('exporting')
  await nextFrame()

  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
    let added = 0

    for (const id of pageIds) {
      const el = document.querySelector<HTMLElement>(`.a4-page[data-page-id="${CSS.escape(id)}"]`)
      if (!el) continue

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const img = canvas.toDataURL('image/jpeg', 0.92)
      if (added > 0) pdf.addPage('a4', 'portrait')

      // 페이지 비율을 유지하며 A4 안에 맞춘다
      const ratio = canvas.height / canvas.width
      let w = A4_W
      let h = w * ratio
      if (h > A4_H) {
        h = A4_H
        w = h / ratio
      }
      pdf.addImage(img, 'JPEG', (A4_W - w) / 2, (A4_H - h) / 2, w, h, undefined, 'FAST')
      added++
      onProgress?.(added, pageIds.length)
    }

    if (added === 0) throw new Error('렌더링할 페이지를 찾지 못했습니다.')
    pdf.save(filename)
  } finally {
    document.body.classList.remove('exporting')
    if (wrap) wrap.style.transform = prevTransform
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}
