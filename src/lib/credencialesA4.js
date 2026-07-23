import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { getPersonaFotoUrl } from './personaFotos'
import {
  CARD_H, CARD_W, PREVIEW_W, addContainImage, categoriaCredencial,
  coverImageData, imageData, mx, my, ptFromPx, urlValidacionCredencial,
} from './credenciales'

const A4_W=210,A4_H=297,COLS=3,ROWS=3,PER_SHEET=COLS*ROWS,GAP_X=3,GAP_Y=3
const START_X=(A4_W-(COLS*CARD_W+(COLS-1)*GAP_X))/2
const START_Y=(A4_H-(ROWS*CARD_H+(ROWS-1)*GAP_Y))/2
const ORANGE=[235,102,0]

async function preparar(persona,credencial,logo){
  const [foto,qr]=await Promise.all([
    persona.foto_url?getPersonaFotoUrl(persona.foto_url).then(imageData):Promise.resolve(null),
    QRCode.toDataURL(urlValidacionCredencial(credencial.token),{width:700,margin:1,errorCorrectionLevel:'H'}),
  ])
  const fotoRecortada=foto?await coverImageData(foto,462,436,credencial.foto_pos_x,credencial.foto_pos_y,credencial.foto_zoom):null
  return {persona,credencial,logo,fotoRecortada,qr}
}

function base(pdf){
  pdf.setFillColor(250,250,250);pdf.rect(0,0,CARD_W,CARD_H,'F')
  pdf.setDrawColor(215);pdf.roundedRect(.5,.5,CARD_W-1,CARD_H-1,2.5,2.5)
}

function frente(pdf,{persona,credencial,logo,fotoRecortada}){
  const nombre=[persona.nombre,persona.apellido].filter(Boolean).join(' ').toUpperCase()
  const sede=credencial.sede_nombre||'Administración Central',category=categoriaCredencial(persona)
  base(pdf)
  addContainImage(pdf,logo,mx(12),my(3),mx(PREVIEW_W-24),my(40))
  const fotoW=mx(231),stripX=fotoW,stripW=CARD_W-fotoW,fotoY=my(46),fotoH=my(218)
  pdf.setFillColor(...ORANGE);pdf.rect(stripX,fotoY,stripW,fotoH,'F')
  if(fotoRecortada)pdf.addImage(fotoRecortada,'JPEG',0,fotoY,fotoW,fotoH,undefined,'FAST')
  else{pdf.setFillColor(223,227,232);pdf.rect(0,fotoY,fotoW,fotoH,'F')}
  const letters=category.split(''),letterLine=my(28*1.05),lettersTop=fotoY+(fotoH-letters.length*letterLine)/2
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(28))
  letters.forEach((letter,i)=>pdf.text(letter,stripX+stripW/2,lettersTop+letterLine*i+letterLine/2,{align:'center',baseline:'middle'}))
  const infoTop=my(264),infoH=my(121),infoX=mx(12),infoW=mx(PREVIEW_W-24),infoBottom=infoTop+infoH-my(4)
  pdf.setFillColor(250,250,250);pdf.rect(0,infoTop,CARD_W,infoH,'F')
  let cursor=infoTop+my(7);const gap=my(2)
  pdf.setTextColor(15);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(18))
  const nameLines=pdf.splitTextToSize(nombre,infoW),nameLine=my(18*1.05)
  nameLines.forEach((line,i)=>pdf.text(line,infoX,cursor+nameLine*i,{baseline:'top'}))
  cursor+=nameLines.length*nameLine+gap
  if(persona.dni){pdf.setFontSize(ptFromPx(10.5));pdf.text(`DNI ${persona.dni}`,infoX,cursor,{baseline:'top'});cursor+=my(10.5*1.2)+gap}
  pdf.setFontSize(ptFromPx(11.5));pdf.text('FLY KITCHEN S.A.',infoX,cursor,{baseline:'top'});cursor+=my(11.5*1.2)+gap
  pdf.setTextColor(215,91,0);pdf.setFontSize(ptFromPx(9.5))
  const puesto=String(credencial.puesto_impreso||persona.puesto||'SIN PUESTO').toUpperCase(),puestoLine=my(9.5*1.1)
  pdf.splitTextToSize(puesto,infoW).forEach((line,i)=>pdf.text(line,infoX,cursor+puestoLine*i,{baseline:'top'}))
  pdf.setTextColor(35);pdf.setFont('helvetica','normal');pdf.setFontSize(ptFromPx(8))
  pdf.text(sede.toUpperCase(),infoX,infoBottom,{baseline:'bottom',maxWidth:mx(190)})
  if(credencial.grupo_sanguineo){
    pdf.setTextColor(215,91,0);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(11))
    pdf.text(credencial.grupo_sanguineo,CARD_W-infoX,infoBottom,{align:'right',baseline:'bottom'})
  }
  const expiryTop=my(385),expiryH=my(43)
  pdf.setFillColor(...ORANGE);pdf.rect(0,expiryTop,CARD_W,expiryH,'F')
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(18))
  pdf.text(`VENCE  ${format(new Date(`${credencial.fecha_vencimiento}T12:00:00`),'dd·MM·yyyy')}`,CARD_W/2,expiryTop+expiryH/2,{align:'center',baseline:'middle'})
}

function dorso(pdf,{logo,qr}){
  base(pdf)
  addContainImage(pdf,logo,mx(16),my(8),mx(PREVIEW_W-32),my(50))
  const qrSize=my(166),qrTop=my(70)
  pdf.addImage(qr,'PNG',(CARD_W-qrSize)/2,qrTop,qrSize,qrSize)
  const rule=my(2);let backY=qrTop+qrSize+my(4)
  pdf.setFillColor(...ORANGE);pdf.rect(0,backY,CARD_W,rule,'F');backY+=rule+my(9)
  pdf.setTextColor(20);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(11))
  const validarLine=my(11*1.2)
  ;['VALIDAR CREDENCIAL','Y GUARDAR CONTACTO'].forEach((line,i)=>pdf.text(line,CARD_W/2,backY+validarLine*i,{align:'center',baseline:'top'}))
  backY+=2*validarLine+my(9);pdf.setFillColor(...ORANGE);pdf.rect(0,backY,CARD_W,rule,'F');backY+=rule+my(15)
  const bodyLine=my(9*1.55)
  pdf.setFont('helvetica','normal');pdf.setFontSize(ptFromPx(9));pdf.setTextColor(35)
  pdf.text('Esta credencial es propiedad de',CARD_W/2,backY,{align:'center',baseline:'top'})
  pdf.setTextColor(...ORANGE);pdf.setFont('helvetica','bold');pdf.text('Fly Kitchen S.A.',CARD_W/2,backY+bodyLine,{align:'center',baseline:'top'})
  pdf.setTextColor(35);pdf.setFont('helvetica','normal')
  pdf.text('En caso de extravío,',CARD_W/2,backY+bodyLine*3,{align:'center',baseline:'top'})
  pdf.text('remitir a Recursos Humanos.',CARD_W/2,backY+bodyLine*4,{align:'center',baseline:'top'})
  const expiryTop=my(385),expiryH=my(43)
  pdf.setFillColor(...ORANGE);pdf.rect(0,expiryTop,CARD_W,expiryH,'F')
  pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(ptFromPx(8))
  pdf.text('ALIMENTAMOS LO QUE NOS MUEVE',CARD_W/2,expiryTop+expiryH/2,{align:'center',baseline:'middle'})
}

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
  const preparados=await Promise.all(items.map(({persona,credencial})=>preparar(persona,credencial,logo)))
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  for(let offset=0;offset<preparados.length;offset+=PER_SHEET){
    if(offset>0)pdf.addPage('a4','portrait')
    const sheet=preparados.slice(offset,offset+PER_SHEET)
    sheet.forEach((item,index)=>dibujar(pdf,item,frente,index,false))
    pdf.addPage('a4','portrait')
    sheet.forEach((item,index)=>dibujar(pdf,item,dorso,index,true))
  }
  pdf.save(`Credenciales-Fly-Kitchen-${format(new Date(),'yyyy-MM-dd')}.pdf`)
}

export const hojasCredencialesA4=cantidad=>Math.ceil(Number(cantidad||0)/PER_SHEET)
