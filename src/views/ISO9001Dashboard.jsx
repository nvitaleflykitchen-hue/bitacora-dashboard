import { useCallback, useEffect, useMemo, useState } from 'react'
import { differenceInDays, format } from 'date-fns'
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileCheck2, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react'
import { getCapa, getNoConformidades, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'

const ESTADOS_NC_ABIERTA = new Set(['Abierta', 'En proceso'])
const ESTADOS_CAPA_CERRADA = new Set(['Completada', 'Verificada'])

function pct(part, total) {
  if (!total) return 100
  return Math.round((part / total) * 100)
}

function daysBetween(from, to) {
  if (!from || !to) return null
  return Math.max(0, differenceInDays(new Date(to), new Date(from)))
}

function KpiCard({ label, value, detail, tone = 'ok', icon: Icon }) {
  const color = tone === 'bad' ? 'var(--alert)' : tone === 'warn' ? 'var(--warn)' : 'var(--phosphor)'
  return (
    <div className="kpi-card" style={{ borderColor: tone === 'bad' ? 'rgba(255,42,42,0.28)' : tone === 'warn' ? 'rgba(245,158,11,0.28)' : undefined }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div>
          <p className="kpi-value" style={{ color }}>{value}</p>
          <p className="kpi-label">{label}</p>
        </div>
        {Icon && <Icon size={22} style={{ color, opacity:0.75 }} />}
      </div>
      {detail && <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:8 }}>{detail}</p>}
    </div>
  )
}

function Bar({ value, color = 'var(--phosphor)' }) {
  return (
    <div className="progress-bar" style={{ marginTop:6 }}>
      <div className="progress-fill" style={{ width:`${Math.max(0, Math.min(100, value))}%`, background:color, boxShadow:`0 0 6px ${color}55` }} />
    </div>
  )
}

function ClauseCard({ clause, title, status, detail, progress }) {
  const tone = progress >= 80 ? 'ok' : progress >= 50 ? 'warn' : 'bad'
  const color = tone === 'ok' ? 'var(--phosphor)' : tone === 'warn' ? 'var(--warn)' : 'var(--alert)'
  return (
    <div className="glass rounded p-4" style={{ borderRadius:3, borderColor:`${color}44` }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
        <div>
          <p className="font-metric text-xs tracking-widest" style={{ color }}>{clause}</p>
          <h3 className="font-title font-bold text-sm mt-1" style={{ color:'var(--text)' }}>{title}</h3>
        </div>
        <span className={`chip ${tone === 'ok' ? 'chip-green' : tone === 'warn' ? 'chip-yellow' : 'chip-red'}`} style={{ fontSize:'0.6rem' }}>{status}</span>
      </div>
      <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', lineHeight:1.45, marginTop:10 }}>{detail}</p>
      <Bar value={progress} color={color} />
      <p className="font-metric" style={{ color, fontSize:'0.62rem', marginTop:5 }}>{progress}% cubierto con registros actuales</p>
    </div>
  )
}

function ListBlock({ title, empty, items, renderItem }) {
  return (
    <div className="glass rounded p-4" style={{ borderRadius:3 }}>
      <h3 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{empty}</p>
        ) : items.map(renderItem)}
      </div>
    </div>
  )
}

export default function ISO9001Dashboard({ onOpenTab }) {
  const { allowedSedeIds } = useAuth()
  const [loading, setLoading] = useState(true)
  const [ncs, setNcs] = useState([])
  const [capas, setCapas] = useState([])
  const [sedes, setSedes] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ncData, capaData, sedesData] = await Promise.all([
        getNoConformidades({ sedeIds: allowedSedeIds || undefined }),
        getCapa({ sedeIds: allowedSedeIds || undefined }),
        getSedes(allowedSedeIds),
      ])
      setNcs(ncData || [])
      setCapas(capaData || [])
      setSedes(sedesData || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const today = new Date()
    const ncAbiertas = ncs.filter(nc => ESTADOS_NC_ABIERTA.has(nc.estado))
    const ncCerradas = ncs.filter(nc => ['Cerrada', 'Verificada'].includes(nc.estado))
    const ncSinCausa = ncAbiertas.filter(nc => !String(nc.causa_raiz || '').trim())
    const ncSinCapa = ncAbiertas.filter(nc => !nc.capa?.length)
    const capaAbiertas = capas.filter(c => !ESTADOS_CAPA_CERRADA.has(c.estado))
    const capaVencidas = capaAbiertas.filter(c => c.fecha_limite && new Date(c.fecha_limite) < today)
    const capaPorVencer = capaAbiertas.filter(c => {
      if (!c.fecha_limite) return false
      const d = differenceInDays(new Date(c.fecha_limite), today)
      return d >= 0 && d <= 7
    })
    const capaCompletadas = capas.filter(c => c.estado === 'Completada')
    const eficaciaPendiente = capas.filter(c => c.estado === 'Completada' && !c.eficacia_verificada)
    const eficaciaOk = capas.filter(c => c.estado === 'Verificada' || c.eficacia_verificada)
    const cierres = ncCerradas.map(nc => daysBetween(nc.fecha_apertura, nc.fecha_cierre || nc.updated_at)).filter(v => v != null)
    const diasPromedioCierre = cierres.length ? Math.round(cierres.reduce((a, b) => a + b, 0) / cierres.length) : 0
    const conCausa = ncs.filter(nc => String(nc.causa_raiz || '').trim()).length
    const conResponsable = [...ncs, ...capas].filter(item => String(item.responsable || '').trim()).length
    const totalRegistrosIso = ncs.length + capas.length

    const byCategory = Object.entries(ncs.reduce((acc, nc) => {
      const key = nc.categoria || 'Sin categoría'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const bySede = Object.entries(ncs.reduce((acc, nc) => {
      const key = nc.sede_nombre || sedes.find(s => s.id === nc.sede_id)?.nombre || 'Sin sede'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return {
      ncAbiertas, ncCerradas, ncSinCausa, ncSinCapa,
      capaAbiertas, capaVencidas, capaPorVencer, capaCompletadas, eficaciaPendiente, eficaciaOk,
      diasPromedioCierre, byCategory, bySede,
      pctNcConCausa: pct(conCausa, ncs.length),
      pctResponsables: pct(conResponsable, totalRegistrosIso),
      pctCapaEficacia: pct(eficaciaOk.length, capas.length),
      pctCapaEnFecha: pct(capaAbiertas.length - capaVencidas.length, capaAbiertas.length),
      pctNcConCapa: pct(ncAbiertas.length - ncSinCapa.length, ncAbiertas.length),
    }
  }, [ncs, capas, sedes])

  const clauses = [
    {
      clause:'ISO 9001 · 8.7',
      title:'Control de salidas no conformes',
      status: stats.ncAbiertas.length ? 'En control' : 'Sin abiertas',
      progress: stats.ncAbiertas.length ? Math.min(100, Math.round((stats.pctResponsables + stats.pctNcConCausa) / 2)) : 100,
      detail:'Las NC registran sede, categoría, responsable, estado, evidencia y trazabilidad de apertura/cierre.',
    },
    {
      clause:'ISO 9001 · 10.2',
      title:'No conformidad y acción correctiva',
      status: stats.ncSinCapa.length ? 'Revisar' : 'Cubierto',
      progress: Math.round((stats.pctNcConCapa + stats.pctCapaEficacia) / 2),
      detail:'La mejora clave es que cada NC relevante tenga CAPA y que la acción quede verificada por eficacia.',
    },
    {
      clause:'ISO 9001 · 9.1',
      title:'Seguimiento, medición y análisis',
      status: 'Activo',
      progress: 80,
      detail:'El tablero consolida NC, CAPA vencidas, tiempos de cierre, reincidencias por sede y categoría.',
    },
    {
      clause:'ISO 9001 · 9.2',
      title:'Auditoría interna',
      status: 'Parcial',
      progress: capas.some(c => c.auditoria_codigo) ? 65 : 35,
      detail:'CAPA ya permite agrupar por código de auditoría. El próximo paso es una pantalla de programa de auditorías.',
    },
    {
      clause:'ISO 9001 · 7.5',
      title:'Información documentada',
      status: 'Parcial',
      progress: 55,
      detail:'La app guarda evidencias y adjuntos. Falta formalizar control documental por versión/revisión.',
    },
  ]

  const acciones = [
    ...stats.ncSinCausa.slice(0, 3).map(nc => ({ tipo:'NC sin causa raíz', codigo:nc.codigo, texto:nc.descripcion, tab:'nc', tone:'warn' })),
    ...stats.ncSinCapa.slice(0, 3).map(nc => ({ tipo:'NC sin CAPA', codigo:nc.codigo, texto:nc.descripcion, tab:'nc', tone:'bad' })),
    ...stats.capaVencidas.slice(0, 3).map(c => ({ tipo:'CAPA vencida', codigo:c.codigo, texto:c.descripcion, tab:'capa', tone:'bad' })),
    ...stats.eficaciaPendiente.slice(0, 3).map(c => ({ tipo:'Eficacia pendiente', codigo:c.codigo, texto:c.descripcion, tab:'capa', tone:'warn' })),
  ].slice(0, 8)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      <PageHeader title="ISO 9001:2015" subtitle="Control de NC, CAPA, eficacia y mejora continua sin cambiar el flujo operativo">
        <div className="flex gap-2">
          <button onClick={() => onOpenTab?.('nc')} className="btn-ghost" style={{ padding:'0.35rem 0.75rem' }}>Ver NC</button>
          <button onClick={() => onOpenTab?.('capa')} className="btn-ghost" style={{ padding:'0.35rem 0.75rem' }}>Ver CAPA</button>
          <button onClick={load} className="btn-primary flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <KpiCard label="NC abiertas" value={stats.ncAbiertas.length} detail={`${stats.ncCerradas.length} cerradas/verificadas`} tone={stats.ncAbiertas.length ? 'warn' : 'ok'} icon={AlertTriangle} />
            <KpiCard label="CAPA vencidas" value={stats.capaVencidas.length} detail={`${stats.capaPorVencer.length} vencen en 7 días`} tone={stats.capaVencidas.length ? 'bad' : stats.capaPorVencer.length ? 'warn' : 'ok'} icon={ClipboardCheck} />
            <KpiCard label="Eficacia verificada" value={`${stats.pctCapaEficacia}%`} detail={`${stats.eficaciaOk.length}/${capas.length} CAPA`} tone={stats.pctCapaEficacia < 60 ? 'warn' : 'ok'} icon={ShieldCheck} />
            <KpiCard label="NC con causa raíz" value={`${stats.pctNcConCausa}%`} detail={`${stats.ncSinCausa.length} abiertas sin causa`} tone={stats.ncSinCausa.length ? 'warn' : 'ok'} icon={FileCheck2} />
            <KpiCard label="Cierre promedio" value={`${stats.diasPromedioCierre} d`} detail="NC cerradas/verificadas" tone={stats.diasPromedioCierre > 14 ? 'warn' : 'ok'} icon={TrendingUp} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
            {clauses.map(c => <ClauseCard key={c.clause} {...c} />)}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ListBlock
              title="Próximas acciones ISO"
              empty="No hay acciones urgentes detectadas."
              items={acciones}
              renderItem={(item, idx) => (
                <button key={`${item.tipo}-${item.codigo}-${idx}`} onClick={() => onOpenTab?.(item.tab)}
                  className="w-full text-left rounded px-3 py-2"
                  style={{ background:item.tone === 'bad' ? 'rgba(255,42,42,0.08)' : 'rgba(245,158,11,0.08)', border:`1px solid ${item.tone === 'bad' ? 'rgba(255,42,42,0.22)' : 'rgba(245,158,11,0.22)'}` }}>
                  <p className="font-metric text-xs" style={{ color:item.tone === 'bad' ? 'var(--alert)' : 'var(--warn)' }}>{item.tipo} · {item.codigo}</p>
                  <p style={{ color:'var(--text)', fontSize:'0.75rem', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.texto}</p>
                </button>
              )}
            />

            <ListBlock
              title="Reincidencia por categoría"
              empty="Sin NC registradas."
              items={stats.byCategory}
              renderItem={([categoria, count]) => (
                <div key={categoria} className="rounded px-3 py-2" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
                    <span style={{ color:'var(--text)', fontSize:'0.78rem' }}>{categoria}</span>
                    <span className="font-metric" style={{ color:'var(--phosphor)' }}>{count}</span>
                  </div>
                  <Bar value={pct(count, ncs.length)} color="var(--phosphor)" />
                </div>
              )}
            />

            <ListBlock
              title="Reincidencia por sede"
              empty="Sin NC por sede."
              items={stats.bySede}
              renderItem={([sede, count]) => (
                <div key={sede} className="rounded px-3 py-2" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
                    <span style={{ color:'var(--text)', fontSize:'0.78rem' }}>{sede}</span>
                    <span className="font-metric" style={{ color:'var(--phosphor)' }}>{count}</span>
                  </div>
                  <Bar value={pct(count, ncs.length)} color="var(--warn)" />
                </div>
              )}
            />
          </div>

          <div className="glass rounded p-4" style={{ borderRadius:3, borderColor:'rgba(57,255,20,0.18)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <CheckCircle2 size={18} style={{ color:'var(--phosphor)' }} />
              <div>
                <h3 className="font-title font-bold text-sm" style={{ color:'var(--text)' }}>Siguiente mejora recomendada</h3>
                <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', marginTop:3 }}>
                  Crear el programa de auditorías internas ISO 9001: alta de auditoría, alcance, criterios, hallazgos y generación automática de NC/CAPA.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
