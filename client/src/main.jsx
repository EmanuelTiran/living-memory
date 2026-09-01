import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/rubik/hebrew-400.css'
import '@fontsource/rubik/hebrew-500.css'
import '@fontsource/rubik/hebrew-600.css'
import '@fontsource/rubik/hebrew-700.css'
import '@fontsource/rubik/latin-400.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-600.css'
import '@fontsource/rubik/latin-700.css'
import './index.css'
import './visualRefresh.css'
import App from './App.jsx'
import AuraTooltipLayer from './AuraTooltipLayer.jsx'
import './auraVisualSystem.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    <AuraTooltipLayer />
  </StrictMode>,
)
