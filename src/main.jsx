import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import McpConnect from './components/McpConnect.jsx'

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(error=>console.warn('No se pudo activar el modo offline:',error)))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {window.location.pathname === '/mcp/connect' ? <McpConnect /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
)
