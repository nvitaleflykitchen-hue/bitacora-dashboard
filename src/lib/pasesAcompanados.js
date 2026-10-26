import { supabase } from './supabase'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
export const paseUrl = token => `${window.location.origin}/?pase=${token}`
export async function paseRpc(name,args) { const {data,error}=await supabase.rpc(name,args); if(error)throw error; return data }
export async function getPases() {
 const [p,e,open]=await Promise.all([
 supabase.schema('equipo').from('pases_acompanados').select('*').order('codigo'),
 supabase.schema('equipo').from('pase_entregas').select('*,sector:credencial_sectores(nombre,codigo,sede_id),titular:personas!persona_id(nombre,apellido),acompanante:personas!acompanante_id(nombre,apellido)').order('desde',{ascending:false}).limit(1000),
 supabase.schema('equipo').from('pase_entregas').select('*,sector:credencial_sectores(nombre,codigo,sede_id),titular:personas!persona_id(nombre,apellido),acompanante:personas!acompanante_id(nombre,apellido)').is('devuelto_at',null)])
 if(p.error||e.error||open.error)throw p.error||e.error||open.error
 return {pases:p.data,entregas:[...new Map([...open.data,...e.data].map(item=>[item.id,item])).values()]}
}
export async function crearPasePdf(pase) {
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:[54,85.6]})
 pdf.setFillColor(pase.tipo==='visita'?'#164E63':'#92400E');pdf.rect(0,0,54,22,'F')
 pdf.setTextColor('#ffffff');pdf.setFontSize(11);pdf.text('FLY KITCHEN',27,7,{align:'center'})
 pdf.setFontSize(9);pdf.text(pase.tipo==='visita'?'VISITA ACOMPAÑADA':'ACCESO TEMPORAL',27,13,{align:'center'})
 if(pase.tipo!=='visita')pdf.text('ACOMPAÑADO',27,18,{align:'center'})
 pdf.setTextColor('#111111');pdf.setFontSize(12);pdf.text(pase.tipo==='visita'?'VISITA':pase.codigo,27,29,{align:'center'})
 pdf.addImage(await QRCode.toDataURL(paseUrl(pase.token),{margin:2,width:600,errorCorrectionLevel:'M'}),'PNG',9,32,36,36)
 pdf.setFontSize(7);pdf.text(['ACOMPAÑAMIENTO OBLIGATORIO','Escanear para validar titular,','sector, acompañante y vigencia.','La tarjeta sola no autoriza el ingreso.'],27,72,{align:'center'})
 return pdf
}

export async function descargarPase(pase) { (await crearPasePdf(pase)).save(`${pase.codigo}.pdf`) }
