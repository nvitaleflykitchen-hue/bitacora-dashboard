import { describe, expect, it } from 'vitest'
import { ROLES, canAccessView, canSeeQualityTask, canWrite, getDefaultView, getPrimaryNav, isQualityTeamPerson } from './access'

describe('matriz de acceso', () => {
  // Tope real hoy: admin/editor/consultor/grupo/encargado ven 9 accesos
  // (6 operacionales + flotaHub + calidadHub + equipo). Antes de agregar
  // flotaHub ya eran 8, por lo que el límite histórico de "siete" estaba
  // desactualizado independientemente de este cambio.
  it.each(ROLES)('limita el menú principal de %s a nueve accesos', rol => {
    expect(getPrimaryNav(rol).length).toBeLessThanOrEqual(9)
  })

  it('deja al consultor en modo lectura', () => {
    expect(canAccessView('consultor', 'mantenimientoHub')).toBe(true)
    expect(canWrite('consultor', 'mantenimiento', 'manage')).toBe(false)
    expect(canWrite('consultor', 'compras', 'request')).toBe(false)
  })

  it('acota un consultor con permisos de compras al mÃ³dulo Compras', () => {
    const perfil = { id:'u-compras', rol:'consultor', email:'compras@flykitchen.com.ar', compras_permisos:['manage'] }
    expect(getPrimaryNav('consultor', perfil).map(item => item.id)).toEqual(['inicio', 'requerimientos'])
    expect(getDefaultView('consultor', perfil)).toBe('requerimientos')
    expect(canAccessView('consultor', 'requerimientos', perfil)).toBe(true)
    expect(canAccessView('consultor', 'mantenimientoHub', perfil)).toBe(false)
    expect(canAccessView('consultor', 'calidadHub', perfil)).toBe(false)
    expect(canWrite('consultor', 'compras', 'request', perfil)).toBe(true)
    expect(canWrite('consultor', 'compras', 'manage', perfil)).toBe(true)
    expect(canWrite('consultor', 'calidad', 'manage', perfil)).toBe(false)
  })

  it('permite a sede reportar sin administrar', () => {
    expect(canWrite('sede', 'mantenimiento', 'report')).toBe(true)
    expect(canWrite('sede', 'mantenimiento', 'manage')).toBe(false)
    expect(canAccessView('sede', 'calidadHub')).toBe(false)
  })

  it('reserva administración para admin', () => {
    expect(canAccessView('admin', 'usuarios')).toBe(true)
    expect(canAccessView('editor', 'usuarios')).toBe(false)
  })

  it('acota a operario a bitácora (reportar), sin tickets/compras/escritorio', () => {
    expect(canWrite('operario', 'bitacora', 'report')).toBe(true)
    expect(canWrite('operario', 'bitacora', 'attach')).toBe(true)
    expect(canWrite('operario', 'compras', 'request')).toBe(false)
    expect(canWrite('operario', 'mantenimiento', 'report')).toBe(false)
    expect(canAccessView('operario', 'inicio')).toBe(false)
    expect(getPrimaryNav('operario').length).toBe(0)
  })

  it('da a flota su propio módulo, sin Mantenimiento ni Calidad', () => {
    expect(canAccessView('flota', 'flotaHub')).toBe(true)
    expect(canAccessView('flota', 'mantenimientoHub')).toBe(false)
    expect(canAccessView('flota', 'calidadHub')).toBe(false)
    expect(canWrite('flota', 'flota', 'manage')).toBe(true)
    expect(canWrite('flota', 'mantenimiento', 'manage')).toBe(false)
  })
  it('permite a grupo generar no conformidades dentro de Calidad', () => {
    expect(canAccessView('grupo', 'calidadHub')).toBe(true)
    expect(canAccessView('grupo', 'noConformidades')).toBe(true)
    expect(canWrite('grupo', 'calidad', 'manage')).toBe(true)
    expect(canWrite('grupo', 'noConformidades', 'manage')).toBe(true)
  })

  it('acota el usuario de Calidad a pendientes, tareas, calidad y equipo propio', () => {
    const perfil = { id:'u1', nombre:'Tecnica Flykitchen', email:'tecnica@flykitchen.com.ar' }
    expect(getPrimaryNav('editor', perfil).map(item => item.id)).toEqual(['pendientes', 'requerimientos', 'mantenimientoHub', 'flotaHub', 'calidadHub', 'equipo'])
    expect(canAccessView('editor', 'tareas', perfil)).toBe(true)
    expect(canAccessView('editor', 'requerimientos', perfil)).toBe(true)
    expect(canAccessView('editor', 'mantenimientoHub', perfil)).toBe(true)
    expect(canAccessView('editor', 'flotaHub', perfil)).toBe(true)
    expect(canWrite('editor', 'tareas', 'manage', perfil)).toBe(true)
    expect(canWrite('editor', 'compras', 'manage', perfil)).toBe(false)
    expect(canWrite('editor', 'mantenimiento', 'manage', perfil)).toBe(false)
    expect(canWrite('editor', 'flota', 'manage', perfil)).toBe(false)
    expect(canWrite('editor', 'equipo', 'manage', perfil)).toBe(false)
  })

  it('reconoce tareas propias o de calidad y personas del equipo calidad', () => {
    const perfil = { id:'u1', nombre:'Tecnica Flykitchen', email:'tecnica@flykitchen.com.ar' }
    expect(canSeeQualityTask({ responsable_id:'u1' }, perfil)).toBe(true)
    expect(canSeeQualityTask({ categoria:'F', titulo:'Limpieza BPM' }, perfil)).toBe(true)
    expect(canSeeQualityTask({ titulo:'Comprar vasos', categoria:'C' }, perfil)).toBe(false)
    expect(isQualityTeamPerson({ area:'Calidad', puesto:'Tecnica' }, perfil)).toBe(true)
    expect(isQualityTeamPerson({ area:'Cocina', puesto:'Cocinero' }, perfil)).toBe(false)
  })
})
