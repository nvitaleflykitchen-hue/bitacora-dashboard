const OLLAMA_URL='http://127.0.0.1:11434'
export const COPILOTO_MODEL='llama3.2:latest'
const MAX_ITEMS=6
const MAX_TEXT_LENGTH=150

function textoBreve(value,max=MAX_TEXT_LENGTH){
  const text=String(value||'').replace(/\s+/g,' ').trim()
  return text.length>max?`${text.slice(0,max-1)}…`:text
}

export async function estadoCopilotoLocal(){
  const response=await fetch(`${OLLAMA_URL}/api/tags`,{signal:AbortSignal.timeout(2500)})
  if(!response.ok)throw new Error('Ollama no respondió')
  const data=await response.json()
  const models=(data.models||[]).map(model=>model.name)
  return {available:models.includes(COPILOTO_MODEL),models,model:COPILOTO_MODEL}
}

export function contextoSeguro(items=[]){
  return items.slice(0,MAX_ITEMS).map(({module,title,status,site,owner,priority,date})=>({
    modulo:textoBreve(module,30),
    asunto:textoBreve(title),
    estado:textoBreve(status,30),
    sede:textoBreve(site,60),
    responsable:textoBreve(owner,60),
    prioridad:textoBreve(priority,20),
    fecha:textoBreve(date,30),
  }))
}

export async function consultarCopilotoLocal({items=[],modo='resumen',onChunk}){
  const instrucciones={resumen:'Prepará una bandeja ejecutiva breve: qué atender hoy, qué está vencido, qué espera aprobación o respuesta y tres próximos pasos.',prioridades:'Ordená los asuntos por urgencia e impacto. Explicá en una línea por qué priorizaste cada uno.',respuesta:'Redactá un mensaje cordial de seguimiento para los asuntos que esperan respuesta. No afirmes datos que no estén en el contexto.'}
  const response=await fetch(`${OLLAMA_URL}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:COPILOTO_MODEL,stream:true,keep_alive:'10m',options:{temperature:.2,num_ctx:1024,num_predict:96},messages:[{role:'system',content:'Sos Copiloto Fly. Usá sólo el contexto recibido, no inventes datos. Respondé en español argentino con viñetas y máximo 90 palabras.'},{role:'user',content:`${instrucciones[modo]||instrucciones.resumen}\nAsuntos (${Math.min(items.length,MAX_ITEMS)} de ${items.length}): ${JSON.stringify(contextoSeguro(items))}`}]}),signal:AbortSignal.timeout(120000)})
  if(!response.ok)throw new Error(`Ollama respondió ${response.status}`)
  if(!response.body)throw new Error('Ollama no devolvió contenido')
  const reader=response.body.getReader()
  const decoder=new TextDecoder()
  let pending=''
  let answer=''
  while(true){
    const {done,value}=await reader.read()
    pending+=decoder.decode(value||new Uint8Array(),{stream:!done})
    const lines=pending.split('\n')
    pending=done?'':lines.pop()||''
    for(const line of lines){
      if(!line.trim())continue
      const data=JSON.parse(line)
      answer+=data.message?.content||''
      if(onChunk)onChunk(answer)
    }
    if(done)break
  }
  return answer.trim()||'No se generó una respuesta.'
}
