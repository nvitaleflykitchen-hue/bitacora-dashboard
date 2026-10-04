import { it,expect,vi } from 'vitest'
const rpc=vi.hoisted(()=>vi.fn())
vi.mock('./supabase',()=>({db:()=>({rpc}),supabase:{}}))
import { saveForm,transitionForm,listForms } from './formulariosPermisos'
const draft={template_id:'template',sede_id:1,persona_ids:['person'],variables:{}}
it('accepts composite rows returned as an array or object without changing list responses',async()=>{
 const form={id:'form',version:1}
 rpc.mockResolvedValueOnce({data:[form]});expect(await saveForm(draft)).toEqual(form)
 rpc.mockResolvedValueOnce({data:form});expect(await transitionForm(form,'firmado')).toEqual(form)
 rpc.mockResolvedValueOnce({data:[form]});expect(await listForms()).toEqual([form])
 rpc.mockResolvedValueOnce({data:[]});await expect(saveForm(draft)).rejects.toThrow('No se recibió')
})
