import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/frank-ruhl-libre/hebrew-500.css'
import '@fontsource/frank-ruhl-libre/hebrew-600.css'
import '@fontsource/frank-ruhl-libre/hebrew-700.css'
import '@fontsource/frank-ruhl-libre/latin-500.css'
import '@fontsource/frank-ruhl-libre/latin-600.css'
import '@fontsource/frank-ruhl-libre/latin-700.css'
import '@fontsource/rubik/hebrew-400.css'
import '@fontsource/rubik/hebrew-500.css'
import '@fontsource/rubik/hebrew-600.css'
import '@fontsource/rubik/latin-400.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-600.css'
import './index.css'
import './visualRefresh.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)