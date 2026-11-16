"""Etiquetas permanentes: reutilizan la ruta de activos de Fly Gestión."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public'/'recursos'/'qr-gran-porte-aeropuertos.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
vehicles=[('Hyundai','JDN192','57bd3777-dc2e-4282-b5c7-d4dc4e5e618a'),('Hyundai HD 78 Euro III','JDN191','ec3d01cb-8f3f-4d22-a543-ce5308201875'),('Mercedes ATEGO','AH213XP','71660e05-bc42-41ba-98e9-3f5275c0fb72'),('Mercedes ATEGO','AH172MY','04f0921e-903d-407b-a0a7-7e18cc953e7b')]
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('Fly Gestión - QR de vehículos de gran porte')
c.setFont('Helvetica-Bold',16);c.drawString(15*mm,280*mm,'FLY GESTIÓN | GRAN PORTE')
c.setFont('Helvetica',10);c.drawString(15*mm,272*mm,'Aeropuertos · Etiquetas permanentes por vehículo')
for i,(model,plate,uid) in enumerate(vehicles):
    x=(15+(i%2)*94)*mm;y=(145-(i//2)*118)*mm;w=86*mm;h=109*mm
    c.setStrokeColorRGB(.65,.65,.65);c.setDash(2,3);c.rect(x,y,w,h);c.setDash()
    c.setFillColorRGB(.06,.13,.1);c.setFont('Helvetica-Bold',11);c.drawCentredString(x+w/2,y+h-10*mm,'FLYKITCHEN · FLY GESTIÓN')
    c.setFillColorRGB(0,0,0);c.setFont('Helvetica-Bold',22);c.drawCentredString(x+w/2,y+h-23*mm,plate)
    c.setFont('Helvetica',10);c.drawCentredString(x+w/2,y+h-31*mm,model)
    url=f'https://bitacora-dashboard.vercel.app/?scan=activo&id={uid}'
    qr=QrCodeWidget(url,barLevel='M');bounds=qr.getBounds();size=55*mm
    drawing=Drawing(size,size,transform=[size/(bounds[2]-bounds[0]),0,0,size/(bounds[3]-bounds[1]),0,0]);drawing.add(qr)
    renderPDF.draw(drawing,c,x+(w-size)/2,y+19*mm)
    c.setFont('Helvetica-Bold',10);c.drawCentredString(x+w/2,y+14*mm,'Escaneá para realizar el control')
    c.setFont('Helvetica',8);c.drawCentredString(x+w/2,y+8*mm,'Ingresá con tu usuario de Fly Gestión')
c.setFont('Helvetica',9);c.drawString(15*mm,15*mm,'Imprimir al 100% · Recortar por la línea punteada · Colocar en la cabina')
c.save()
print(OUT)
