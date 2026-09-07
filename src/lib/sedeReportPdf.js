import { cargarInformeSede, rangoInformeSede } from './sedeReport'
import { crearInformeSedePDF, nombreInformeSede } from './sedeReportRenderer'

export async function generarInformeSedePDF(options) {
  const report = await cargarInformeSede({ ...rangoInformeSede(), ...options })
  crearInformeSedePDF(report).save(nombreInformeSede(report))
  return report
}
