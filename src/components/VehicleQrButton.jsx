import React from 'react'
import {jsPDF} from 'jspdf'
import QRCode from 'qrcode'
import {fleetVehicleUrl} from '../lib/fleetQr'
import {toast} from '../lib/feedback'
export default function VehicleQrButton({vehicle}){
 return <button className="btn-ghost" onClick={async()=>{try{const pdf=new jsPDF();const qr=await QRCode.toDataURL(fleetVehicleUrl(vehicle.id),{width:700,margin:4});pdf.setFontSize(20);pdf.text('Fly Gestión · Control del vehículo',15,25);pdf.setFontSize(12);pdf.text(pdf.splitTextToSize(vehicle.nombre||'Vehículo',180),15,40);pdf.text(vehicle.sede_nombre||'',15,55);pdf.addImage(qr,'PNG',45,70,120,120);pdf.text('Escaneá e ingresá con tu usuario de Fly Gestión',15,210);pdf.save(`QR-vehiculo-${vehicle.id}.pdf`)}catch(e){toast.error(e.message)}}}>Imprimir QR del vehículo</button>
}
