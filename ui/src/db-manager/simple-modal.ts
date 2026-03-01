// Version simplifiée du modal DB Manager (vanilla JS)
import * as api from './api-simple'

export function openDbManager() {
  // Créer le modal
  const modal = document.createElement('div')
  modal.id = 'db-manager-modal'
  modal.innerHTML = `
    <div class="db-modal-overlay">
      <div class="db-modal-container">
        <div class="db-modal-header">
          <h2>🗄️ Gestionnaire de Base de Données</h2>
          <button class="db-modal-close">×</button>
        </div>
        <div class="db-modal-body">
          <div class="db-sidebar">
            <div class="db-loading">Chargement du schéma...</div>
          </div>
          <div class="db-main">
            <div class="db-toolbar">
              <button class="db-btn" id="db-toggle-mode">🔒 Mode Lecture</button>
            </div>
            <div class="db-content">
              <div class="db-empty">Sélectionnez une table dans le panneau de gauche</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
  
  // Styles
  const style = document.createElement('style')
  style.textContent = `
    .db-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }
    .db-modal-container {
      background: #1e2530;
      border-radius: 12px;
      width: 95vw;
      height: 90vh;
      max-width: 1800px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .db-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #2d3748;
      background: #252d3a;
    }
    .db-modal-header h2 {
      margin: 0;
      color: #e2e8f0;
      font-size: 20px;
    }
    .db-modal-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 32px;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      border-radius: 6px;
    }
    .db-modal-close:hover {
      background: #374151;
      color: #e2e8f0;
    }
    .db-modal-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .db-sidebar {
      width: 280px;
      border-right: 1px solid #2d3748;
      background: #252d3a;
      overflow-y: auto;
      padding: 16px;
    }
    .db-main {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .db-toolbar {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #2d3748;
      background: #252d3a;
    }
    .db-btn {
      padding: 8px 16px;
      border: 1px solid #2d3748;
      background: #1e2530;
      color: #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .db-btn:hover {
      background: #374151;
    }
    .db-content {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    .db-loading, .db-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
    }
    .db-schema-item {
      margin-bottom: 8px;
    }
    .db-schema-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      cursor: pointer;
      border-radius: 6px;
      color: #e2e8f0;
    }
    .db-schema-header:hover {
      background: #374151;
    }
    .db-table-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      margin-left: 20px;
      cursor: pointer;
      border-radius: 6px;
      font-size: 13px;
      color: #cbd5e1;
    }
    .db-table-item:hover {
      background: #374151;
    }
    .db-table-item.selected {
      background: #3b82f6;
      color: white;
    }
    .db-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .db-table th {
      padding: 12px;
      text-align: left;
      background: #252d3a;
      color: #e2e8f0;
      border-bottom: 2px solid #2d3748;
      position: sticky;
      top: 0;
    }
    .db-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #2d3748;
      color: #e2e8f0;
    }
    .db-table tbody tr:hover {
      background: #374151;
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(modal)
  
  // Event listeners
  const closeBtn = modal.querySelector('.db-modal-close')
  closeBtn?.addEventListener('click', () => {
    modal.remove()
    style.remove()
  })
  
  const overlay = modal.querySelector('.db-modal-overlay')
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      modal.remove()
      style.remove()
    }
  })
  
  // Charger le schéma
  loadSchema(modal)
}

async function loadSchema(modal: HTMLElement) {
  const sidebar = modal.querySelector('.db-sidebar')
  if (!sidebar) return
  
  try {
    const schema = await api.getSchema()
    
    let html = ''
    for (const s of schema.schemas) {
      html += `
        <div class="db-schema-item">
          <div class="db-schema-header">
            <span>📁 ${s.name}</span>
            <span style="margin-left:auto;font-size:11px;color:#94a3b8">${s.tables.length}</span>
          </div>
          ${s.tables.map(t => `
            <div class="db-table-item" data-schema="${s.name}" data-table="${t.name}">
              <span>📊</span>
              <span>${t.name}</span>
              <span style="margin-left:auto;font-size:10px;color:#94a3b8">${t.row_count}</span>
            </div>
          `).join('')}
        </div>
      `
    }
    
    sidebar.innerHTML = html
    
    // Event listeners pour les tables
    sidebar.querySelectorAll('.db-table-item').forEach(item => {
      item.addEventListener('click', () => {
        const schema = item.getAttribute('data-schema')!
        const table = item.getAttribute('data-table')!
        
        // Mettre à jour la sélection
        sidebar.querySelectorAll('.db-table-item').forEach(i => i.classList.remove('selected'))
        item.classList.add('selected')
        
        // Charger les données
        loadTableData(modal, schema, table)
      })
    })
    
  } catch (err) {
    sidebar.innerHTML = `<div style="color:#ef4444;padding:16px">Erreur: ${err}</div>`
  }
}

async function loadTableData(modal: HTMLElement, schema: string, table: string) {
  const content = modal.querySelector('.db-content')
  if (!content) return
  
  content.innerHTML = '<div class="db-loading">Chargement des données...</div>'
  
  try {
    const data = await api.getTableData(schema, table, { limit: 100, offset: 0 })
    
    let html = `
      <table class="db-table">
        <thead>
          <tr>
            ${data.columns.map(c => `<th>${c.name} <span style="font-size:10px;color:#94a3b8">(${c.data_type})</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(row => `
            <tr>
              ${data.columns.map(c => `<td>${row[c.name] ?? 'NULL'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">
        Affichage de ${data.rows.length} sur ${data.total_count} lignes
      </div>
    `
    
    content.innerHTML = html
    
  } catch (err) {
    content.innerHTML = `<div style="color:#ef4444;padding:16px">Erreur: ${err}</div>`
  }
}
