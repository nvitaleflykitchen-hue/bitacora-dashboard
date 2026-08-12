import { useEffect,useState } from 'react'
import { Package,Plus,Printer,RefreshCw } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { cargarEpp,crearEnvioEpp,crearProductoEpp,imprimirEtiquetasEpp } from '../../lib/epp'

const emptyProduct={codigo:'',nombre:'',categoria:'epp',descripcion:'',talles:'',requiere_devolucion:false,reposicion_periodica:false}
export default function UniformesEppPanel({sedes=[]}){
  const {user,perfil}=useAuth(); const canAdmin=['admin','editor'].includes(perfil?.rol)
  const [data,setData]=useState({catalogo:[],envios:[]}); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
  const [producto,setProducto]=useState(emptyProduct); const [envio,setEnvio]=useState({sedeId:'',bultos:1,observaciones:''}); const [selected,setSelected]=useState([])
  const load=()=>{setLoading(true);setError('');cargarEpp().then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false))}
  useEffect(load,[])
  const saveProduct=async()=>{try{await crearProductoEpp(producto,user.id);setProducto(emptyProduct);load()}catch(e){setError(e.message)}}
  const saveShipment=async()=>{try{await crearEnvioEpp(envio,user.id);setEnvio({sedeId:'',bultos:1,observaciones:''});load()}catch(e){setError(e.message)}}
  const labels=data.envios.flatMap(e=>(e.epp_envio_bultos||[]).map(b=>({...b,sede:e.sede?.nombre||'Sede',total:e.epp_envio_bultos.length})))
  const print=()=>imprimirEtiquetasEpp(labels.filter(x=>selected.includes(x.id))).catch(e=>setError(e.message))
  return <div className="space-y-4">
    <div className="flex justify-between items-center"><div><h2 className="font-title font-bold" style={{color:'var(--phosphor)'}}>Uniformes y EPP</h2><p style={{color:'var(--text-dim)',fontSize:'.72rem'}}>Catálogo, envíos, bultos y trazabilidad por sede.</p></div><button className="btn-ghost" onClick={load}><RefreshCw size={14}/> Actualizar</button></div>
    {error&&<div className="glass p-3" style={{color:'var(--alert)'}}>{error}</div>}
    {canAdmin&&<div className="grid md:grid-cols-2 gap-4">
      <div className="glass p-4"><h3 className="font-metric mb-3">1 · CATÁLOGO</h3><div className="grid grid-cols-2 gap-2"><input className="input-dark" placeholder="Código" value={producto.codigo} onChange={e=>setProducto({...producto,codigo:e.target.value})}/><input className="input-dark" placeholder="Nombre" value={producto.nombre} onChange={e=>setProducto({...producto,nombre:e.target.value})}/><select className="input-dark" value={producto.categoria} onChange={e=>setProducto({...producto,categoria:e.target.value})}>{['epp','uniforme','calzado','credencial','otro'].map(x=><option key={x}>{x}</option>)}</select><input className="input-dark" placeholder="Talles: S, M, L, XL" value={producto.talles} onChange={e=>setProducto({...producto,talles:e.target.value})}/></div><textarea className="input-dark w-full mt-2" placeholder="Descripción" value={producto.descripcion} onChange={e=>setProducto({...producto,descripcion:e.target.value})}/><button className="btn-primary mt-2" disabled={!producto.codigo||!producto.nombre} onClick={saveProduct}><Plus size={13}/> Crear producto</button></div>
      <div className="glass p-4"><h3 className="font-metric mb-3">2 · NUEVO ENVÍO</h3><select className="input-dark w-full" value={envio.sedeId} onChange={e=>setEnvio({...envio,sedeId:e.target.value})}><option value="">Elegir sede...</option>{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select><input className="input-dark w-full mt-2" type="number" min="1" value={envio.bultos} onChange={e=>setEnvio({...envio,bultos:e.target.value})}/><textarea className="input-dark w-full mt-2" placeholder="Observaciones" value={envio.observaciones} onChange={e=>setEnvio({...envio,observaciones:e.target.value})}/><button className="btn-primary mt-2" disabled={!envio.sedeId} onClick={saveShipment}><Package size={13}/> Crear envío y bultos</button></div>
    </div>}
    <div className="glass p-4"><div className="flex justify-between items-center mb-3"><h3 className="font-metric">BULTOS PARA IMPRIMIR</h3><button className="btn-primary" disabled={!selected.length} onClick={print}><Printer size={13}/> Imprimir seleccionados ({selected.length})</button></div>{loading?<p>Cargando...</p>:!labels.length?<p style={{color:'var(--text-dim)'}}>Todavía no hay bultos.</p>:<div className="grid md:grid-cols-3 gap-2">{labels.map(b=><label key={b.id} className="p-3 flex gap-2" style={{border:'1px solid rgba(255,255,255,.1)'}}><input type="checkbox" checked={selected.includes(b.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,b.id]:v.filter(id=>id!==b.id))}/><span><strong>{b.codigo}</strong><br/><small>{b.sede} · Bulto {b.numero}/{b.total}</small></span></label>)}</div>}</div>
  </div>
}
