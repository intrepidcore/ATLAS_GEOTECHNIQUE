import React from 'react'
import ReactDOM from 'react-dom/client'
import './design-tokens.css'
import './index.css'
import { SplashApp } from './splash/SplashApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SplashApp />
  </React.StrictMode>,
)
