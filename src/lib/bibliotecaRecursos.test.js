import { describe,it,expect,vi } from 'vitest'
vi.mock('./supabase',()=>({db:vi.fn(),supabase:{}}))
import { validateResource } from './bibliotecaRecursos'
describe('validación de recursos',()=>{
 it('rechaza URL insegura y credenciales en enlaces',()=>{
  for(const url of ['javascript:alert(1)','http://example.com','https://user:password@example.com']) expect(()=>validateResource({titulo:'Manual',url})).toThrow()
  expect(validateResource({titulo:'Manual',url:'https://example.com/manual'},null)).toBeNull()
 })
 it('valida tamaño y tipo de archivos antes de subirlos',()=>{
  expect(()=>validateResource({titulo:'Manual'},{name:'manual.html',size:30})).toThrow()
  expect(()=>validateResource({titulo:'Manual'},{name:'manual.pdf',size:21*1024*1024})).toThrow()
  expect(validateResource({titulo:'Manual'},{name:'manual.PDF',size:300})).toEqual({extension:'pdf',contentType:'application/pdf'})
 })
})
