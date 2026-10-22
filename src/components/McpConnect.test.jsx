import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import McpConnect from './McpConnect'

vi.mock('../lib/auth', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: { email: 'test@example.invalid' }, loading: false }) }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) } } }))
vi.mock('./LoginPage', () => ({ default: () => <div>Login</div> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('MCP consent', () => {
  it('never approves automatically and preserves an authorization error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ client_name: 'Gemini', redirect_origin: 'https://gemini.google.com', sede_ids: [19], scope: 'mcp:read' }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Cuenta no autorizada' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<McpConnect />)
    expect(await screen.findByText('Gemini')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar consultas' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cuenta no autorizada')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer test-session')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).approve).toBe(true)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Autorizar consultas' })).not.toBeDisabled())
  })
  it('shows expired request without enabling authorization', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Solicitud vencida' }) }))
    render(<McpConnect />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Solicitud vencida')
    expect(screen.queryByRole('button', { name: 'Autorizar consultas' })).not.toBeInTheDocument()
  })
})
