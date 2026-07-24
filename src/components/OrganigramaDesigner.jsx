import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow,
  addEdge, applyEdgeChanges, applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Download, Eye, LayoutDashboard, Maximize2, Pencil, Plus, Redo2, Save, Search,
  Trash2, Undo2, Users, X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { loadSharedOrganigrama, publishSharedOrganigrama, saveSharedOrganigramaDraft } from '../lib/organigramaStore'
import { exportOrganigramaPdf } from '../lib/organigramaPdf'

const COLORS = {
  direccion:'#39ff14',
  operaciones:'#22c55e',
  calidad:'#f59e0b',
  soporte:'#38bdf8',
  sede:'#a3e635',
}

const storageKey = (groupId, state) => `flygestion:org-designer:${groupId || 'general'}:${state}`

function nodeFromSeed(seed, index) {
  return {
    id:seed.id,
    type:'orgCard',
    position:seed.position || { x:80 + (index % 4) * 290, y:80 + Math.floor(index / 4) * 190 },
    data:{
      label:seed.label || 'Sin asignar',
      role:seed.role || 'Responsable',
      area:seed.area || '',
      contactId:seed.contactId || null,
      entityType:seed.entityType || 'persona',
      linkedScope:seed.linkedScope || null,
      color:seed.color || COLORS[seed.entityType === 'sede' ? 'sede' : 'operaciones'],
    },
  }
}

export function mergeRequiredStructure(model, seeds, seedEdges) {
  const base = model || { nodes:[], edges:[] }
  const nodes = [...(base.nodes || [])]
  const edges = [...(base.edges || [])]
  const nodeIds = new Set(nodes.map(node => node.id))
  const edgeIds = new Set(edges.map(edge => edge.id))

  seeds.filter(seed => seed.required).forEach((seed, index) => {
    if (!nodeIds.has(seed.id)) {
      nodes.push(nodeFromSeed(seed, nodes.length + index))
      nodeIds.add(seed.id)
    }
  })
  seedEdges.filter(edge => edge.required).forEach(edge => {
    if (!edgeIds.has(edge.id) && nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      edges.push(edge)
      edgeIds.add(edge.id)
    }
  })
  return { ...base, nodes, edges }
}

function OrgCard({ data, selected }) {
  return (
    <article style={{
      width:240, minHeight:108, padding:'14px 16px', borderRadius:8,
      border:`2px solid ${selected ? data.color : `${data.color}66`}`,
      background:'linear-gradient(145deg, rgba(28,30,36,.98), rgba(15,17,21,.98))',
      boxShadow:selected ? `0 0 0 3px ${data.color}22, 0 12px 30px rgba(0,0,0,.4)` : '0 8px 22px rgba(0,0,0,.28)',
      color:'var(--text)',
    }}>
      <Handle type="target" position={Position.Top} style={{ width:10, height:10, background:data.color, border:'2px solid #101116' }}/>
      <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
        <div style={{ width:34, height:34, borderRadius:8, display:'grid', placeItems:'center', color:data.color, background:`${data.color}16`, border:`1px solid ${data.color}55` }}>
          <Users size={16}/>
        </div>
        <div style={{ minWidth:0 }}>
          <p style={{ fontWeight:800, fontSize:'.78rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{data.label}</p>
          <p className="font-metric" style={{ color:data.color, fontSize:'.56rem', marginTop:4, letterSpacing:'.06em' }}>{data.role}</p>
          {data.area && <p style={{ color:'var(--text-dim)', fontSize:'.6rem', marginTop:4 }}>{data.area}</p>}
          {data.linkedScope && <p className="font-metric" style={{ color:'var(--text-dim)', fontSize:'.5rem', marginTop:7 }}>DOBLE CLIC PARA ABRIR</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ width:10, height:10, background:data.color, border:'2px solid #101116' }}/>
    </article>
  )
}

const nodeTypes = { orgCard:OrgCard }

export function wouldCreateCycle(connection, nodes, edges) {
  if (!connection.source || !connection.target || connection.source === connection.target) return true
  const adjacency = new Map()
  ;[...edges, connection].forEach(edge => {
    const list = adjacency.get(edge.source) || []
    list.push(edge.target)
    adjacency.set(edge.source, list)
  })
  const seen = new Set()
  const visit = id => {
    if (id === connection.source && seen.size) return true
    if (seen.has(id)) return false
    seen.add(id)
    return (adjacency.get(id) || []).some(visit)
  }
  return visit(connection.target) || !nodes.some(node => node.id === connection.target)
}

export function autoLayout(nodes, edges) {
  const children = new Map()
  const targets = new Set(edges.map(edge => edge.target))
  edges.forEach(edge => children.set(edge.source, [...(children.get(edge.source) || []), edge.target]))
  const roots = nodes.filter(node => !targets.has(node.id))
  const levels = []
  const queue = roots.map(node => ({ id:node.id, level:0 }))
  const visited = new Set()
  while (queue.length) {
    const current = queue.shift()
    if (visited.has(current.id)) continue
    visited.add(current.id)
    ;(levels[current.level] ||= []).push(current.id)
    ;(children.get(current.id) || []).forEach(id => queue.push({ id, level:current.level + 1 }))
  }
  nodes.filter(node => !visited.has(node.id)).forEach(node => (levels[levels.length] ||= []).push(node.id))
  const positions = new Map()
  levels.forEach((ids, level) => {
    const width = ids.length * 290
    ids.forEach((id, index) => positions.set(id, { x:index * 290 - width / 2, y:level * 180 }))
  })
  return nodes.map(node => ({ ...node, position:positions.get(node.id) || node.position }))
}

export default function OrganigramaDesigner({ groupId, groupName, seeds, seedEdges, contacts, canEdit, onOpenScope, showGlobalBreadcrumb }) {
  const [openMode, setOpenMode] = useState(null)
  const readPublished = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(storageKey(groupId, 'published')) || 'null') } catch { return null }
  }, [groupId])
  const [published, setPublished] = useState(readPublished)
  useEffect(() => {
    let active = true
    setPublished(readPublished())
    loadSharedOrganigrama(groupId)
      .then(result => {
        if (active && result.record?.publicado) setPublished(result.record.publicado)
      })
      .catch(() => {})
    return () => { active = false }
  }, [groupId, readPublished])
  const previewModel = published
    ? mergeRequiredStructure(published, seeds, seedEdges)
    : { nodes:seeds.map(nodeFromSeed), edges:seedEdges }
  const previewNodes = previewModel.nodes
  const previewEdges = previewModel.edges

  return (
    <>
      <div className="glass" style={{ padding:'1rem', border:'1px solid rgba(57,255,20,.14)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-title font-bold" style={{ color:'var(--text)' }}>ORGANIGRAMA · {groupName}</p>
            <p style={{ color:'var(--text-dim)', fontSize:'.67rem', marginTop:4 }}>Vista publicada. Abrila en pantalla completa para recorrerla o descargarla en PDF.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpenMode('view')}><Maximize2 size={14}/> VER PANTALLA COMPLETA</button>
            {canEdit && <button type="button" className="btn-primary" onClick={() => setOpenMode('edit')}><Pencil size={14}/> EDITAR</button>}
          </div>
        </div>
        <div style={{ height:360, marginTop:14, border:'1px solid rgba(255,255,255,.06)', borderRadius:6, overflow:'hidden' }}>
          <ReactFlow key={`${groupId}:${previewNodes.length}:${previewEdges.length}`} nodes={previewNodes.map(node => ({ ...node, draggable:false, selectable:false }))} edges={previewEdges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding:.18 }} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnScroll zoomOnScroll onNodeDoubleClick={(_, node) => node.data.linkedScope && onOpenScope?.(node.data.linkedScope)}>
            <Background color="rgba(57,255,20,.12)" gap={24}/>
            <Controls showInteractive={false}/>
          </ReactFlow>
        </div>
      </div>
      {openMode && <DesignerWorkspace key={`${groupId}:${openMode}`} groupId={groupId} groupName={groupName} seeds={seeds} seedEdges={seedEdges} contacts={contacts} canEdit={openMode === 'edit' && canEdit} onClose={() => setOpenMode(null)} onPublished={() => setPublished(readPublished())} onOpenScope={onOpenScope} showGlobalBreadcrumb={showGlobalBreadcrumb}/>}
    </>
  )
}

function DesignerWorkspace({ groupId, groupName, seeds, seedEdges, contacts, canEdit, onClose, onPublished, onOpenScope, showGlobalBreadcrumb }) {
  const { user } = useAuth()
  const initial = useMemo(() => {
    const fallback = { nodes:seeds.map(nodeFromSeed), edges:seedEdges }
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey(groupId, 'draft')) || 'null') || JSON.parse(localStorage.getItem(storageKey(groupId, 'published')) || 'null')
      return stored ? mergeRequiredStructure(stored, seeds, seedEdges) : fallback
    } catch { return fallback }
  }, [groupId, seedEdges, seeds])
  const [nodes, setNodes] = useState(initial.nodes)
  const [edges, setEdges] = useState(initial.edges)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [syncState, setSyncState] = useState('local')
  const [sharedVersion, setSharedVersion] = useState(0)
  const history = useRef([{ nodes:initial.nodes, edges:initial.edges }])
  const historyIndex = useRef(0)
  const flowRef = useRef(null)
  const canvasRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    let active = true
    loadSharedOrganigrama(groupId).then(result => {
      if (!active) return
      if (!result.available) {
        setSyncState('local')
        return
      }
      setSyncState('shared')
      setSharedVersion(result.record?.version_publicada || 0)
      const remote = result.record?.borrador || result.record?.publicado
      if (remote?.nodes && remote?.edges) {
        const merged = mergeRequiredStructure(remote, seeds, seedEdges)
        setNodes(merged.nodes)
        setEdges(merged.edges)
        history.current = [{ nodes:merged.nodes, edges:merged.edges }]
        historyIndex.current = 0
        window.setTimeout(() => flowRef.current?.fitView({ padding:.14, duration:250 }), 0)
      }
    }).catch(() => setSyncState('error'))
    return () => { active = false }
  }, [groupId, seedEdges, seeds])

  const snapshot = useCallback((nextNodes, nextEdges) => {
    history.current = history.current.slice(0, historyIndex.current + 1)
    history.current.push({ nodes:nextNodes, edges:nextEdges })
    historyIndex.current += 1
    setDirty(true)
  }, [])
  const commit = useCallback((nextNodes, nextEdges) => {
    setNodes(nextNodes); setEdges(nextEdges); snapshot(nextNodes, nextEdges)
  }, [snapshot])
  const undo = () => {
    if (historyIndex.current === 0) return
    historyIndex.current -= 1
    const state = history.current[historyIndex.current]
    setNodes(state.nodes); setEdges(state.edges); setDirty(true)
  }
  const redo = () => {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current += 1
    const state = history.current[historyIndex.current]
    setNodes(state.nodes); setEdges(state.edges); setDirty(true)
  }
  const onConnect = connection => {
    if (!canEdit || wouldCreateCycle(connection, nodes, edges)) return
    const withoutOldParent = edges.filter(edge => (
      edge.target !== connection.target
      || ['funcional','apoyo','comunicacion'].includes(edge.data?.relationType)
    ))
    commit(nodes, addEdge({
      ...connection,
      type:'smoothstep',
      markerEnd:{ type:MarkerType.ArrowClosed, color:'#39ff14' },
      data:{ relationType:'jerarquica', lineStyle:'solid', color:'#39ff14', width:1.7, arrow:true },
      style:{ stroke:'#39ff14', strokeWidth:1.7 },
    }, withoutOldParent))
  }
  const addPerson = contact => {
    if (!canEdit || nodes.some(node => node.data.contactId === contact.id)) return
    const node = nodeFromSeed({ id:`contact:${contact.id}`, contactId:contact.id, label:contact.nombre, role:contact.cargo || 'Responsable', area:contact.area || '', color:COLORS.operaciones }, nodes.length)
    commit([...nodes, node], edges)
    setSelectedId(node.id)
    setSelectedEdgeId(null)
  }
  const removeSelected = () => {
    if (!selectedId || !canEdit) return
    commit(nodes.filter(node => node.id !== selectedId), edges.filter(edge => edge.source !== selectedId && edge.target !== selectedId))
    setSelectedId(null)
  }
  const updateSelected = patch => {
    const next = nodes.map(node => node.id === selectedId ? { ...node, data:{ ...node.data, ...patch } } : node)
    commit(next, edges)
  }
  const selectedEdge = edges.find(edge => edge.id === selectedEdgeId)
  const updateSelectedEdge = patch => {
    if (!selectedEdge || !canEdit) return
    const data = { relationType:'jerarquica', lineStyle:'solid', color:'#39ff14', width:1.7, arrow:true, ...(selectedEdge.data || {}), ...patch }
    const strokeDasharray = data.lineStyle === 'dashed' ? '8 6' : data.lineStyle === 'dotted' ? '2 5' : undefined
    const next = edges.map(edge => edge.id === selectedEdgeId ? {
      ...edge,
      label:data.label || undefined,
      data,
      style:{ ...(edge.style || {}), stroke:data.color, strokeWidth:Number(data.width), strokeDasharray },
      markerEnd:data.arrow ? { type:MarkerType.ArrowClosed, color:data.color } : undefined,
    } : edge)
    commit(nodes, next)
  }
  const removeSelectedEdge = () => {
    if (!selectedEdgeId || !canEdit) return
    commit(nodes, edges.filter(edge => edge.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }
  const saveDraft = async () => {
    const model = { nodes, edges, updatedAt:new Date().toISOString() }
    localStorage.setItem(storageKey(groupId, 'draft'), JSON.stringify(model))
    setSyncState('saving')
    try {
      const result = await saveSharedOrganigramaDraft({ groupKey:groupId, name:groupName, model, userId:user?.id })
      setSyncState(result.available ? 'shared' : 'local')
      setDirty(false)
    } catch {
      setSyncState('error')
    }
  }
  const publish = async () => {
    const model = { nodes, edges, publishedAt:new Date().toISOString() }
    localStorage.setItem(storageKey(groupId, 'published'), JSON.stringify(model))
    localStorage.setItem(storageKey(groupId, 'draft'), JSON.stringify(model))
    setSyncState('saving')
    try {
      const result = await publishSharedOrganigrama({ groupKey:groupId, name:groupName, model, userId:user?.id, currentVersion:sharedVersion })
      if (result.available) {
        setSharedVersion(result.record.version_publicada)
        setSyncState('shared')
      } else {
        setSyncState('local')
      }
      setDirty(false); onPublished()
    } catch {
      setSyncState('error')
    }
  }
  const fitCanvas = () => flowRef.current?.fitView({ padding:.14, duration:300 })
  const exportPdf = async () => {
    if (exporting) return
    setExportError('')
    setExporting(true)
    try {
      await flowRef.current?.fitView({ padding:.12, duration:0 })
      await new Promise(resolve => window.setTimeout(resolve, 180))
      await exportOrganigramaPdf({ element:canvasRef.current, name:groupName })
    } catch (error) {
      setExportError(error.message || 'No se pudo generar el PDF.')
    } finally {
      setExporting(false)
    }
  }
  const selected = nodes.find(node => node.id === selectedId)
  const usedContactIds = new Set(nodes.map(node => node.data.contactId).filter(Boolean).map(String))
  const available = contacts.filter(contact => !usedContactIds.has(String(contact.id)) && `${contact.nombre} ${contact.cargo || ''}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handler = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (canEdit) saveDraft() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if (event.key === 'Escape') { setSelectedId(null); setSelectedEdgeId(null) }
      const isEditingText = event.target instanceof Element && event.target.closest('input,textarea')
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !isEditingText) removeSelected()
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeId && !isEditingText) removeSelectedEdge()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'grid', gridTemplateRows:'58px 1fr', background:'#0a0b0f' }}>
      <header style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px', borderBottom:'1px solid rgba(57,255,20,.14)', background:'#14161b' }}>
        <button type="button" className="btn-ghost" onClick={onClose}><ArrowLeft size={14}/> VOLVER</button>
        <div style={{ minWidth:0 }}>
          <p className="font-title font-bold" style={{ color:'var(--text)', fontSize:'.84rem' }}>{canEdit ? 'DISEÑADOR' : 'VISOR'} DE ORGANIGRAMA</p>
          <div className="flex items-center gap-1" style={{ marginTop:2 }}>
            {showGlobalBreadcrumb && <><button type="button" onClick={() => onOpenScope?.('__global__')} style={{ color:'var(--phosphor)', fontSize:'.57rem', padding:0 }}>FLY KITCHEN</button><span style={{ color:'var(--text-dim)', fontSize:'.57rem' }}>›</span></>}
            <span style={{ color:'var(--text-dim)', fontSize:'.57rem' }}>{groupName}</span>
          </div>
          <p style={{ color:'var(--text-dim)', fontSize:'.58rem' }}>
            {dirty ? 'CAMBIOS SIN GUARDAR' : 'SIN CAMBIOS'}
            {' · '}{syncState === 'shared' ? `COMPARTIDO${sharedVersion ? ` · V${sharedVersion}` : ''}` : syncState === 'saving' ? 'GUARDANDO…' : syncState === 'error' ? 'ERROR DE SINCRONIZACIÓN' : 'GUARDADO EN ESTE DISPOSITIVO'}
          </p>
          {exportError && <p style={{ color:'#ff6060', fontSize:'.56rem', marginTop:2 }}>{exportError}</p>}
        </div>
        <div className="flex gap-2" style={{ marginLeft:'auto' }}>
          <button type="button" className="btn-ghost" onClick={fitCanvas}><Maximize2 size={14}/> ENCUADRAR</button>
          <button type="button" className="btn-ghost" onClick={exportPdf} disabled={exporting}><Download size={14}/> {exporting ? 'GENERANDO…' : 'PDF'}</button>
          {canEdit && <button type="button" className="btn-ghost" onClick={undo} title="Deshacer"><Undo2 size={14}/></button>}
          {canEdit && <button type="button" className="btn-ghost" onClick={redo} title="Rehacer"><Redo2 size={14}/></button>}
          {canEdit && <button type="button" className="btn-ghost" onClick={() => commit(autoLayout(nodes, edges), edges)}><LayoutDashboard size={14}/> ORDENAR</button>}
          {canEdit && <button type="button" className="btn-ghost" onClick={saveDraft}><Save size={14}/> GUARDAR BORRADOR</button>}
          {canEdit && <button type="button" className="btn-primary" onClick={publish}><Eye size={14}/> PUBLICAR VISTA</button>}
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar"><X size={15}/></button>
        </div>
      </header>
      <div style={{ minHeight:0, display:'grid', gridTemplateColumns:canEdit ? '260px minmax(0,1fr) 280px' : '1fr' }}>
        {canEdit && <aside style={{ padding:12, overflow:'auto', borderRight:'1px solid rgba(255,255,255,.07)', background:'#111319' }}>
          <p className="font-metric" style={{ color:'var(--phosphor)', fontSize:'.62rem' }}>PERSONAS DISPONIBLES</p>
          <div className="relative" style={{ marginTop:10 }}>
            <Search size={13} style={{ position:'absolute', left:9, top:9, color:'var(--text-dim)' }}/>
            <input className="input-dark w-full" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar persona…" style={{ paddingLeft:29, height:32, fontSize:'.66rem' }}/>
          </div>
          <div style={{ display:'grid', gap:7, marginTop:10 }}>
            {available.map(contact => <button key={contact.id} type="button" onClick={() => addPerson(contact)} className="glass" style={{ textAlign:'left', padding:'9px 10px', border:'1px solid rgba(255,255,255,.07)' }}><p style={{ color:'var(--text)', fontSize:'.68rem', fontWeight:700 }}>{contact.nombre}</p><p style={{ color:'var(--text-dim)', fontSize:'.57rem', marginTop:3 }}>{contact.cargo || 'Sin cargo'} <Plus size={11} style={{ float:'right', color:'var(--phosphor)' }}/></p></button>)}
          </div>
        </aside>}
        <main ref={canvasRef} data-organigrama-export-root style={{ minWidth:0, minHeight:0, background:'#0a0b0f' }}>
          <ReactFlow
            nodes={nodes.map(node => ({ ...node, draggable:canEdit, connectable:canEdit }))}
            edges={edges.map(edge => ({ ...edge, className:`org-edge-${edge.data?.relationType || 'jerarquica'}` }))}
            nodeTypes={nodeTypes}
            onNodesChange={changes => setNodes(current => applyNodeChanges(changes, current))}
            onEdgesChange={changes => canEdit && setEdges(current => applyEdgeChanges(changes, current))}
            onNodeDragStop={() => snapshot(nodes, edges)}
            onConnect={onConnect}
            onNodeDoubleClick={(_, node) => node.data.linkedScope && onOpenScope?.(node.data.linkedScope)}
            onSelectionChange={({ nodes:selectedNodes, edges:selectedEdges }) => {
              setSelectedId(selectedNodes[0]?.id || null)
              setSelectedEdgeId(selectedEdges[0]?.id || null)
            }}
            isValidConnection={connection => !wouldCreateCycle(connection, nodes, edges)}
            nodesConnectable={canEdit}
            nodesDraggable={canEdit}
            elementsSelectable
            selectionOnDrag
            multiSelectionKeyCode={['Control','Meta']}
            deleteKeyCode={null}
            fitView
            minZoom={0.15}
            maxZoom={2}
            defaultEdgeOptions={{ type:'smoothstep', markerEnd:{ type:MarkerType.ArrowClosed }, style:{ stroke:'#39ff14', strokeWidth:1.7 } }}
            onInit={instance => { flowRef.current = instance; window.setTimeout(() => instance.fitView({ padding:.14, duration:250 }), 0) }}
          >
            <Background color="rgba(57,255,20,.13)" gap={24}/>
            <Controls/>
            <MiniMap pannable zoomable nodeColor={node => node.data.color || '#39ff14'} maskColor="rgba(5,6,9,.78)"/>
          </ReactFlow>
        </main>
        {canEdit && <aside style={{ padding:14, overflow:'auto', borderLeft:'1px solid rgba(255,255,255,.07)', background:'#111319' }}>
          <p className="font-metric" style={{ color:'var(--phosphor)', fontSize:'.62rem' }}>PROPIEDADES</p>
          {!selected && !selectedEdge && <p style={{ color:'var(--text-dim)', fontSize:'.65rem', marginTop:14, lineHeight:1.5 }}>Seleccioná una tarjeta o una conexión. Arrastrá desde el punto inferior de una tarjeta hacia otra para crear una dependencia.</p>}
          {selected && <div style={{ display:'grid', gap:12, marginTop:14 }}>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>NOMBRE<input className="input-dark w-full" value={selected.data.label} onChange={event => updateSelected({ label:event.target.value })} style={{ marginTop:5 }}/></label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>FUNCIÓN<input className="input-dark w-full" value={selected.data.role} onChange={event => updateSelected({ role:event.target.value })} style={{ marginTop:5 }}/></label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>ÁREA<input className="input-dark w-full" value={selected.data.area || ''} onChange={event => updateSelected({ area:event.target.value })} style={{ marginTop:5 }}/></label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>COLOR<input type="color" value={selected.data.color} onChange={event => updateSelected({ color:event.target.value })} style={{ display:'block', width:'100%', height:34, marginTop:5, background:'transparent', border:0 }}/></label>
            <button type="button" className="btn-ghost" onClick={removeSelected} style={{ color:'#ff6060', marginTop:8 }}><Trash2 size={13}/> QUITAR DEL ORGANIGRAMA</button>
            <p style={{ color:'var(--text-dim)', fontSize:'.56rem', lineHeight:1.45 }}>La ficha de la persona y todos sus registros permanecen intactos.</p>
          </div>}
          {selectedEdge && <div style={{ display:'grid', gap:12, marginTop:14 }}>
            <p className="font-title font-bold" style={{ color:'var(--text)', fontSize:'.72rem' }}>CONEXIÓN</p>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>TIPO
              <select className="input-dark w-full" value={selectedEdge.data?.relationType || 'jerarquica'} onChange={event => updateSelectedEdge({ relationType:event.target.value })} style={{ marginTop:5 }}>
                <option value="jerarquica">Jerárquica</option>
                <option value="funcional">Funcional</option>
                <option value="apoyo">Apoyo / asesoría</option>
                <option value="comunicacion">Comunicación</option>
              </select>
            </label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>ETIQUETA<input className="input-dark w-full" value={selectedEdge.data?.label || selectedEdge.label || ''} onChange={event => updateSelectedEdge({ label:event.target.value })} placeholder="Ej.: reporta a" style={{ marginTop:5 }}/></label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>TRAZO
              <select className="input-dark w-full" value={selectedEdge.data?.lineStyle || 'solid'} onChange={event => updateSelectedEdge({ lineStyle:event.target.value })} style={{ marginTop:5 }}>
                <option value="solid">Continuo</option>
                <option value="dashed">Guiones</option>
                <option value="dotted">Puntos</option>
              </select>
            </label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>COLOR<input type="color" value={selectedEdge.data?.color || selectedEdge.style?.stroke || '#39ff14'} onChange={event => updateSelectedEdge({ color:event.target.value })} style={{ display:'block', width:'100%', height:34, marginTop:5, background:'transparent', border:0 }}/></label>
            <label style={{ color:'var(--text-dim)', fontSize:'.6rem' }}>GROSOR · {selectedEdge.data?.width || selectedEdge.style?.strokeWidth || 1.7}<input type="range" min="1" max="5" step=".25" value={selectedEdge.data?.width || selectedEdge.style?.strokeWidth || 1.7} onChange={event => updateSelectedEdge({ width:Number(event.target.value) })} style={{ width:'100%', marginTop:8 }}/></label>
            <label className="flex items-center gap-2" style={{ color:'var(--text-dim)', fontSize:'.62rem' }}><input type="checkbox" checked={selectedEdge.data?.arrow !== false} onChange={event => updateSelectedEdge({ arrow:event.target.checked })}/> MOSTRAR FLECHA</label>
            <button type="button" className="btn-ghost" onClick={removeSelectedEdge} style={{ color:'#ff6060', marginTop:8 }}><Trash2 size={13}/> ELIMINAR CONEXIÓN</button>
          </div>}
        </aside>}
      </div>
    </div>
  )
}
