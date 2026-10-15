import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { CARD_H,CARD_W,imageData,prepareCredentialPrint,credentialPrintGroups,drawCredentialFront,drawCredentialBack } from './credenciales'

export const expandCredentialCards = items => items.flatMap(item => credentialPrintGroups(item.credencial).map(group=>({...item,group})))

const A4_W=210,A4_H=297,COLS=3,ROWS=3,PER_SHEET=COLS*ROWS,GAP_X=3,GAP_Y=3
const START_X=(A4_W-(COLS*CARD_W+(COLS-1)*GAP_X))/2
const START_Y=(A4_H-(ROWS*CARD_H+(ROWS-1)*GAP_Y))/2

export function posicionCredencialA4(index,invertirColumnas=false){
  const row=Math.floor(index/COLS),originalCol=index%COLS,col=invertirColumnas?COLS-1-originalCol:originalCol
  return {x:START_X+col*(CARD_W+GAP_X),y:START_Y+row*(CARD_H+GAP_Y)}
}

function marcasCorte(pdf,x,y){
  const mark=2,offset=.8
  pdf.setDrawColor(120);pdf.setLineWidth(.12)
  pdf.line(x-offset-mark,y,x-offset,y);pdf.line(x,y-offset-mark,x,y-offset)
  pdf.line(x+CARD_W+offset,y,x+CARD_W+offset+mark,y);pdf.line(x+CARD_W,y-offset-mark,x+CARD_W,y-offset)
  pdf.line(x-offset-mark,y+CARD_H,x-offset,y+CARD_H);pdf.line(x,y+CARD_H+offset,x,y+CARD_H+offset+mark)
  pdf.line(x+CARD_W+offset,y+CARD_H,x+CARD_W+offset+mark,y+CARD_H);pdf.line(x+CARD_W,y+CARD_H+offset,x+CARD_W,y+CARD_H+offset+mark)
}

function dibujar(pdf,item,face,index,invertirColumnas){
  const {x,y}=posicionCredencialA4(index,invertirColumnas)
  // La matriz PDF usa puntos y un eje Y ascendente, aunque jsPDF reciba mm.
  // Convertimos explícitamente para ubicar cada tarjeta en la grilla A4.
  const scaleFactor=pdf.internal.scaleFactor
  pdf.saveGraphicsState()
  pdf.setCurrentTransformationMatrix(new pdf.Matrix(1,0,0,1,x*scaleFactor,-y*scaleFactor))
  face(pdf,item)
  pdf.restoreGraphicsState()
  marcasCorte(pdf,x,y)
}

export async function descargarCredencialesA4(items){
  if(!items.length)throw new Error('Seleccioná al menos una credencial.')
  const logo=await imageData('/fly-kitchen-credencial.png')
  const preparados=expandCredentialCards(await Promise.all(items.map(({persona,credencial})=>prepareCredentialPrint(persona,credencial,logo))))
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  for(let offset=0;offset<preparados.length;offset+=PER_SHEET){
    if(offset>0)pdf.addPage('a4','portrait')
    const sheet=preparados.slice(offset,offset+PER_SHEET)
    sheet.forEach((item,index)=>dibujar(pdf,item,drawCredentialFront,index,false))
    pdf.addPage('a4','portrait')
    sheet.forEach((item,index)=>dibujar(pdf,item,drawCredentialBack,index,true))
  }
  pdf.save(`Credenciales-Fly-Kitchen-${format(new Date(),'yyyy-MM-dd')}.pdf`)
}

export const hojasCredencialesA4=cantidad=>Math.ceil(Number(cantidad||0)/PER_SHEET)
