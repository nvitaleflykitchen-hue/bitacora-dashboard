import { jsPDF } from 'jspdf'

const CARD_WIDTH = 240
const CARD_HEIGHT = 108

const rgb = value => {
  const hex = String(value || '#166534').replace('#', '')
  const normalized = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
  return [
    Number.parseInt(normalized.slice(0, 2), 16) || 0,
    Number.parseInt(normalized.slice(2, 4), 16) || 0,
    Number.parseInt(normalized.slice(4, 6), 16) || 0,
  ]
}

const wrapText = (value, maxChars, maxLines = 2) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  words.forEach(word => {
    const current = lines.at(-1)
    if (!current || `${current} ${word}`.length > maxChars) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  })
  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines)
    visible[maxLines - 1] = `${visible[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`
    return visible
  }
  return lines
}

export const organigramaPdfFilename = name => {
  const safe = String(name || 'general')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `organigrama-${safe || 'general'}.pdf`
}

export function createOrganigramaPrintLayout(nodes, pageWidth = 297, pageHeight = 210) {
  if (!nodes?.length) return { nodes:[], scaleX:1, scaleY:1 }
  const marginX = 10
  const top = 30
  const bottom = 13
  const minX = Math.min(...nodes.map(node => Number(node.position?.x) || 0))
  const minY = Math.min(...nodes.map(node => Number(node.position?.y) || 0))
  const maxX = Math.max(...nodes.map(node => (Number(node.position?.x) || 0) + CARD_WIDTH))
  const maxY = Math.max(...nodes.map(node => (Number(node.position?.y) || 0) + CARD_HEIGHT))
  const scaleX = (pageWidth - marginX * 2) / Math.max(1, maxX - minX)
  const scaleY = (pageHeight - top - bottom) / Math.max(1, maxY - minY)
  return {
    scaleX,
    scaleY,
    nodes:nodes.map(node => ({
      ...node,
      print:{
        x:marginX + ((Number(node.position?.x) || 0) - minX) * scaleX,
        y:top + ((Number(node.position?.y) || 0) - minY) * scaleY,
        width:CARD_WIDTH * scaleX,
        height:CARD_HEIGHT * scaleY,
      },
    })),
  }
}

function drawEdge(pdf, edge, source, target, index) {
  if (!source || !target) return
  const relation = edge.data?.relationType || 'jerarquica'
  const functional = ['funcional', 'apoyo', 'comunicacion'].includes(relation)
  const color = functional ? '#2563eb' : '#166534'
  const [r, g, b] = rgb(color)
  const startX = source.print.x + source.print.width / 2
  const startY = source.print.y + source.print.height
  const endX = target.print.x + target.print.width / 2
  const endY = target.print.y
  const gap = Math.max(4, endY - startY)
  const bendY = startY + gap * .42 + (functional ? (index % 4) * .65 : 0)

  pdf.setDrawColor(r, g, b)
  pdf.setLineWidth(functional ? .35 : .65)
  pdf.setLineDashPattern(functional ? [2.1, 1.4] : [], 0)
  pdf.line(startX, startY, startX, bendY)
  pdf.line(startX, bendY, endX, bendY)
  pdf.line(endX, bendY, endX, endY)
  if (!functional && edge.data?.arrow !== false) {
    pdf.setFillColor(r, g, b)
    pdf.triangle(endX - 1.25, endY - 1.9, endX + 1.25, endY - 1.9, endX, endY, 'F')
  }
}

function drawNode(pdf, node) {
  const { x, y, width, height } = node.print
  const accent = node.data?.color || '#166534'
  const [r, g, b] = rgb(accent)
  const padding = Math.max(2, Math.min(3.5, width * .07))
  const titleSize = Math.max(6.2, Math.min(8.2, width * .205))
  const detailSize = Math.max(5.2, titleSize - 1.3)
  const maxChars = Math.max(12, Math.floor((width - padding * 2) / (titleSize * .18)))

  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(75, 85, 99)
  pdf.setLineWidth(.38)
  pdf.roundedRect(x, y, width, height, 1.7, 1.7, 'FD')
  pdf.setFillColor(r, g, b)
  pdf.rect(x, y, width, 1.35, 'F')

  pdf.setTextColor(17, 24, 39)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(titleSize)
  const titleLines = wrapText(node.data?.label || 'Sin asignar', maxChars, 2)
  titleLines.forEach((line, index) => pdf.text(line, x + padding, y + 5.4 + index * (titleSize * .43)))

  const detailsY = y + 6.2 + titleLines.length * (titleSize * .43)
  pdf.setTextColor(Math.max(0, r - 35), Math.max(0, g - 35), Math.max(0, b - 35))
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(detailSize)
  wrapText(node.data?.role || 'Responsable', maxChars + 3, 2)
    .forEach((line, index) => pdf.text(line, x + padding, detailsY + index * (detailSize * .43)))

  if (node.data?.area && height >= 17) {
    pdf.setTextColor(75, 85, 99)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(Math.max(4.8, detailSize - .5))
    pdf.text(wrapText(node.data.area, maxChars + 5, 1)[0] || '', x + padding, y + height - 3.2)
  }
}

export async function exportOrganigramaPdf({ name, nodes, edges }) {
  if (!nodes?.length) throw new Error('No se encontraron nodos para exportar.')

  const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const layout = createOrganigramaPrintLayout(nodes, pageWidth, pageHeight)
  const nodeMap = new Map(layout.nodes.map(node => [node.id, node]))

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')
  pdf.setTextColor(22, 101, 52)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(`FLY KITCHEN - ${String(name || 'ORGANIGRAMA').toUpperCase()}`, 10, 14)
  pdf.setTextColor(75, 85, 99)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 10, 14, { align:'right' })

  pdf.setDrawColor(22, 101, 52)
  pdf.setLineWidth(.65)
  pdf.setLineDashPattern([], 0)
  pdf.line(10, 22, 18, 22)
  pdf.setTextColor(55, 65, 81)
  pdf.text('Dependencia jerárquica', 20, 23)
  pdf.setDrawColor(37, 99, 235)
  pdf.setLineWidth(.35)
  pdf.setLineDashPattern([2.1, 1.4], 0)
  pdf.line(56, 22, 64, 22)
  pdf.text('Calidad transversal / apoyo', 66, 23)

  ;(edges || []).forEach((edge, index) => drawEdge(pdf, edge, nodeMap.get(edge.source), nodeMap.get(edge.target), index))
  pdf.setLineDashPattern([], 0)
  layout.nodes.forEach(node => drawNode(pdf, node))

  pdf.setTextColor(107, 114, 128)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  pdf.text('Documento de estructura organizativa - Fly Kitchen', 10, pageHeight - 5)
  pdf.save(organigramaPdfFilename(name))
}
