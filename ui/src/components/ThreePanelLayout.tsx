import React, { ReactNode } from 'react'
import { ResizablePanelReact } from './ResizablePanelReact'

interface ThreePanelLayoutProps {
  leftPanel: ReactNode
  centerPanel: ReactNode
  rightPanel: ReactNode
  showLeftPanel?: boolean
  showRightPanel?: boolean
  /** Activer le redimensionnement des panneaux (v3.5.2) */
  resizable?: boolean
  /** Config panneau gauche */
  leftPanelConfig?: {
    minSize?: number
    maxSize?: number
    defaultSize?: number
    storageKey?: string
  }
  /** Config panneau droit */
  rightPanelConfig?: {
    minSize?: number
    maxSize?: number
    defaultSize?: number
    storageKey?: string
  }
}

export function ThreePanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  showLeftPanel = true,
  showRightPanel = true,
  resizable = true,
  leftPanelConfig = {},
  rightPanelConfig = {},
}: ThreePanelLayoutProps) {
  // Config par défaut panneaux
  const leftDefaults = {
    minSize: 180,
    maxSize: 400,
    defaultSize: 256,
    storageKey: 'atlas-left-panel-width',
    ...leftPanelConfig
  }
  
  const rightDefaults = {
    minSize: 250,
    maxSize: 500,
    defaultSize: 320,
    storageKey: 'atlas-right-panel-width',
    ...rightPanelConfig
  }

  return (
    <div className="relative flex h-full w-full">
      {/* Left Panel - Schema Tree */}
      {showLeftPanel && (
        resizable ? (
          <ResizablePanelReact
            direction="horizontal"
            handlePosition="end"
            minSize={leftDefaults.minSize}
            maxSize={leftDefaults.maxSize}
            defaultSize={leftDefaults.defaultSize}
            storageKey={leftDefaults.storageKey}
            className="relative z-20 border-r border-gray-200 dark:border-gray-700"
          >
            {leftPanel}
          </ResizablePanelReact>
        ) : (
          <div className="w-64 flex-shrink-0 relative z-20">
            {leftPanel}
          </div>
        )
      )}

      {/* Center Panel - Main Content */}
      <div className="flex-1 min-w-0 min-h-0 relative z-10">
        {centerPanel}
      </div>

      {/* Right Panel - Staging Changes */}
      {showRightPanel && (
        resizable ? (
          <ResizablePanelReact
            direction="horizontal"
            handlePosition="start"
            minSize={rightDefaults.minSize}
            maxSize={rightDefaults.maxSize}
            defaultSize={rightDefaults.defaultSize}
            storageKey={rightDefaults.storageKey}
            className="relative z-10 border-l border-gray-200 dark:border-gray-700"
          >
            {rightPanel}
          </ResizablePanelReact>
        ) : (
          <div className="w-80 flex-shrink-0 relative z-10">
            {rightPanel}
          </div>
        )
      )}
    </div>
  )
}
