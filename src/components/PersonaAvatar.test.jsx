import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { PersonaAvatar } from './PersonaAvatar'
const mock=vi.hoisted(()=>({urls:vi.fn()}))
vi.mock('../lib/personaFotos',()=>({getPersonaFotoUrls:mock.urls,guardarPersonaFoto:vi.fn(),eliminarPersonaFoto:vi.fn()}))
let observers=[]
beforeEach(()=>{
 observers=[]
 mock.urls.mockReset().mockResolvedValue({thumbnail:'https://example.com/thumb',original:'https://example.com/original'})
 vi.stubGlobal('IntersectionObserver',class { constructor(callback){this.callback=callback;observers.push(this)} observe(){} disconnect(){} })
})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('does not request offscreen photos and loads a card when it approaches the viewport',async()=>{
 render(<><PersonaAvatar persona={{nombre:'Ana',foto_url:'ana.jpg'}}/><PersonaAvatar persona={{nombre:'Luis',foto_url:'luis.jpg'}}/></>)
 expect(mock.urls).not.toHaveBeenCalled()
 act(()=>observers[0].callback([{isIntersecting:true}]))
 expect(await screen.findByRole('img',{name:'Foto de Ana'})).toBeInTheDocument()
 expect(mock.urls).toHaveBeenCalledTimes(1)
 expect(mock.urls).toHaveBeenCalledWith('ana.jpg')
 expect(screen.queryByRole('img',{name:'Foto de Luis'})).toBeNull()
})
it('loads immediately when IntersectionObserver is unavailable',async()=>{
 vi.stubGlobal('IntersectionObserver',undefined)
 render(<PersonaAvatar persona={{nombre:'Ana',foto_url:'ana.jpg'}}/>)
 expect(await screen.findByRole('img')).toBeInTheDocument()
})
it('clears the previous photo on a person change and ignores late responses',async()=>{
 let resolve
 mock.urls.mockImplementationOnce(()=>new Promise(r=>{resolve=r}))
 const view=render(<PersonaAvatar persona={{nombre:'Ana',foto_url:'ana.jpg'}}/>)
 act(()=>observers[0].callback([{isIntersecting:true}]))
 view.rerender(<PersonaAvatar persona={{nombre:'Luis',foto_url:'luis.jpg'}}/>)
 await screen.findByRole('img',{name:'Foto de Luis'})
 await act(async()=>resolve({thumbnail:'https://example.com/ana'}))
 expect(screen.getByRole('img')).toHaveAttribute('src','https://example.com/thumb')
 view.rerender(<PersonaAvatar persona={{nombre:'Otra'}}/>)
 await waitFor(()=>expect(screen.queryByRole('img')).toBeNull())
})
