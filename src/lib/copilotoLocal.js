const OLLAMA_URL='http://127.0.0.1:11434'
export const COPILOTO_MODEL='llama3.2:latest'

export async function estadoCopilotoLocal(){
  const response=await fetch(`${OLLAMA_URL}/api/tags`,{signal:AbortSignal.timeout(2500)})
  if(!response.ok)throw new Error('Ollama no respondió')
  const data=await response.json()
  return {available:true,models:(data.models||[]).map(model=>model.name),model:COPILOTO_MODEL}
}

function contextoSeguro(items=[]){
  return items.slice(0,30).map(({module,title,status,site,owner,priority,date})=>({module,title,status,site,owner,priority,date}))
}

export async function consultarCopilotoLocal({items=[],modo='resumen'}){
  const instrucciones={resumen:'Prepará una bandeja ejecutiva breve: qué atender hoy, qué está vencido, qué espera aprobación o respuesta y tres próximos pasos.',prioridades:'Ordená los asuntos por urgencia e impacto. Explicá en una línea por qué priorizaste cada uno.',respuesta:'Redactá un mensaje cordial de seguimiento para los asuntos que esperan respuesta. No afirmes datos que no estén en el contexto.'}
  const response=await fetch(`${OLLAMA_URL}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:COPILOTO_MODEL,stream:false,options:{temperature:.2},messages:[{role:'system',content:'Sos Copiloto Fly, asistente de gestión de Fly Kitchen. Trabajás sólo con el contexto recibido. No inventes responsables, fechas, causas, aprobaciones ni evidencias. No ejecutás acciones: entregás análisis o borradores para revisión humana. Respondé en español argentino, claro y concreto.'},{role:'user',content:`Tarea: ${instrucciones[modo]||instrucciones.resumen}\nContexto autorizado:\n${JSON.stringify(contextoSeguro(items),null,2)}`}]}),signal:AbortSignal.timeout(90000)})
  if(!response.ok)throw new Error(`Ollama respondió ${response.status}`)
  const data=await response.json()
  return data.message?.content?.trim()||'No se generó una respuesta.'
}
