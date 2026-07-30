// html2canvas and jsPDF are only needed when a receipt is actually opened — dynamically
// imported so they don't bloat the app's initial load (and PWA precache) for every visit.

// Product thumbnails load asynchronously; without this, capturing a receipt that was
// just mounted off-screen (one-click download from a list row) can snapshot before the
// image has painted, producing a blank square instead of the photo.
async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            })
    )
  )
}

async function captureCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const [{ default: html2canvas }] = await Promise.all([import('html2canvas'), waitForImages(element)])
  return html2canvas(element, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true })
}

export async function receiptToPngBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await captureCanvas(element)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to render receipt image'))), 'image/png')
  })
}

export async function receiptToPdfBlob(element: HTMLElement): Promise<Blob> {
  const [canvas, { jsPDF }] = await Promise.all([captureCanvas(element), import('jspdf')])
  const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height)
  return pdf.output('blob')
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type NavigatorWithShare = Navigator & {
  canShare?: (data: { files: File[] }) => boolean
  share?: (data: ShareData) => Promise<void>
}

// Shares a file via the native share sheet (WhatsApp, etc.) when the platform supports
// sharing files; otherwise falls back to a direct browser download.
export async function shareOrDownload(blob: Blob, filename: string, mimeType: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: mimeType })
  const nav = navigator as NavigatorWithShare

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
    }
  }

  downloadBlob(blob, filename)
}
