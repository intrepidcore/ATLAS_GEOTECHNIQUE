import React from 'react'
import ReactDOM from 'react-dom/client'
import './design-tokens.css'
import './index.css'
import { InstallerApp } from './installer/InstallerApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InstallerApp />
  </React.StrictMode>,
)
