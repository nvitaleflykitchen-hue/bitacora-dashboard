import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export const organigramaPdfFilename = name => {
  const safe = String(name || 'general')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `organigrama-${safe || 'general'}.pdf`
}

export async function exportOrganigramaPdf({ element, name }) {
  if (!element) throw new Error('No se encontró el organigrama para exportar.')

  const canvas = await html2canvas(element, {
    backgroundColor:'#ffffff',
    scale:2,
    useCORS:true,
    logging:false,
    ignoreElements:node => node.classList?.contains('react-flow__controls') || node.classList?.contains('react-flow__minimap'),
    onclone:clonedDocument => {
      const root = clonedDocument.querySelector('[data-organigrama-export-root]')
      if (!root) return
      root.style.background = '#ffffff'
      const style = clonedDocument.createElement('style')
      style.textContent = `
        [data-organigrama-export-root],
        [data-organigrama-export-root] .react-flow {
          background: #ffffff !important;
        }
        [data-organigrama-export-root] .react-flow__background {
          display: none !important;
        }
        [data-organigrama-export-root] article {
          background: #ffffff !important;
          border-color: #4b5563 !important;
          box-shadow: none !important;
          color: #111827 !important;
        }
        [data-organigrama-export-root] article p {
          color: #111827 !important;
        }
        [data-organigrama-export-root] article .font-metric {
          color: #166534 !important;
        }
        [data-organigrama-export-root] .react-flow__edge-path {
          stroke: #374151 !important;
        }
        [data-organigrama-export-root] .org-edge-funcional .react-flow__edge-path,
        [data-organigrama-export-root] .org-edge-apoyo .react-flow__edge-path,
        [data-organigrama-export-root] .org-edge-comunicacion .react-flow__edge-path {
          stroke: #1d4ed8 !important;
        }
        [data-organigrama-export-root] marker path {
          fill: #374151 !important;
          stroke: #374151 !important;
        }
      `
      clonedDocument.head.appendChild(style)
    },
  })
  const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const headerHeight = 14
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2 - headerHeight
  const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
  const width = canvas.width * ratio
  const height = canvas.height * ratio
  const x = (pageWidth - width) / 2
  const y = margin + headerHeight + (maxHeight - height) / 2

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')
  pdf.setTextColor(22, 101, 52)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(`FLY KITCHEN - ${String(name || 'ORGANIGRAMA').toUpperCase()}`, margin, margin + 6)
  pdf.setTextColor(75, 85, 99)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, pageWidth - margin, margin + 6, { align:'right' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, width, height, undefined, 'FAST')
  pdf.save(organigramaPdfFilename(name))
}
