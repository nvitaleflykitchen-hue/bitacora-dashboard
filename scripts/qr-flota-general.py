"""Etiquetas A4 de flota general. Datos de inventario verificados el 17/11/2026."""
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
vehicles = json.loads((ROOT/'src/data/vehicleQrCatalog.json').read_text(encoding='utf-8'))
out = ROOT/'public/recursos/qr-flota-general.pdf'
out.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(out), pagesize=A4)
c.setTitle('Fly Gestión - QR permanentes de flota general')

def centered(text, y, size=10, bold=False):
    font='Helvetica-Bold' if bold else 'Helvetica'
    while c.stringWidth(text,font,size)>86*mm: size-=.5
    c.setFont(font,size);c.drawCentredString(x+45*mm,y,text)

for i,v in enumerate(vehicles):
    slot=i%6
    if slot==0:
        if i: c.showPage()
        c.setFont('Helvetica-Bold',15);c.drawString(12*mm,283*mm,'FLY GESTIÓN | QR DE FLOTA')
        c.setFont('Helvetica',9);c.drawString(12*mm,276*mm,'Control diario por vehículo - Imprimir al 100% y recortar')
        c.drawRightString(198*mm,10*mm,f'Hoja {i//6+1} de {(len(vehicles)+5)//6}')
    x=(12+(slot%2)*96)*mm;y=(184-(slot//2)*85)*mm
    c.setStrokeColorRGB(.6,.6,.6);c.setDash(2,3);c.rect(x,y,90*mm,81*mm);c.setDash()
    centered(v['codigo_interno'],y+73*mm,16,True)
    centered(v['nombre'],y+67*mm,9)
    centered(v['sede_nombre'] or 'Sin sede registrada',y+61*mm,9,True)
    url=f"https://bitacora-dashboard.vercel.app/?scan=activo&id={v['id']}"
    qr=QrCodeWidget(url,barLevel='M');bounds=qr.getBounds();size=43*mm
    drawing=Drawing(size,size,transform=[size/(bounds[2]-bounds[0]),0,0,size/(bounds[3]-bounds[1]),0,0]);drawing.add(qr)
    renderPDF.draw(drawing,c,x+(90*mm-size)/2,y+15*mm)
    centered('Escaneá e ingresá con tu usuario',y+11*mm,9)
    centered('Control diario - ID '+v['id'][:8],y+5*mm,8)
c.save()
print(out)
