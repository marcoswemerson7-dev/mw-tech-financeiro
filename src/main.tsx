import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './reference-theme.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import ToastHost, { installToastAlerts } from './components/ToastHost.tsx'

installToastAlerts()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <ToastHost />
    </BrowserRouter>
  </StrictMode>,
)
