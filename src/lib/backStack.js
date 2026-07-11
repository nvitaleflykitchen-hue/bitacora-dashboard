import { useEffect, useRef } from 'react'

// Botón "atrás" nativo en la versión móvil.
// La navegación de la app es 100% estado interno (sin router), así que el
// back del celular cerraba la PWA. Este módulo arma un "guardián" en el
// historial del navegador y mantiene una pila de handlers: cada vista/modal
// registra qué significa "volver" para ella. Al apretar atrás se ejecuta el
// handler más profundo (modal → detalle → pestaña → salir de verdad).

const handlers = []
let activo = false

function armarGuard() {
  window.history.pushState({ fkBack: true }, '')
}

export function initBackNavigation() {
  if (activo) return () => {}
  activo = true
  armarGuard()
  const onPop = () => {
    const h = handlers[handlers.length - 1]
    if (h) {
      h()
      armarGuard() // reponer la entrada consumida
    } else {
      // No queda nada que cerrar: dejar salir de verdad.
      window.removeEventListener('popstate', onPop)
      activo = false
      window.history.back()
    }
  }
  window.addEventListener('popstate', onPop)
  return () => { window.removeEventListener('popstate', onPop); activo = false }
}

/**
 * Registra qué hace "atrás" mientras `cuando` sea true.
 * El último registrado activo es el que responde (pila).
 *   useBackHandler(() => setModal(null), !!modal)
 */
export function useBackHandler(handler, cuando = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!cuando) return
    const fn = () => ref.current()
    handlers.push(fn)
    return () => {
      const i = handlers.lastIndexOf(fn)
      if (i >= 0) handlers.splice(i, 1)
    }
  }, [cuando])
}
