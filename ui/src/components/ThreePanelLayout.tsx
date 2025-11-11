import React, { ReactNode } from 'react'

interface ThreePanelLayoutProps {
  leftPanel: ReactNode
  centerPanel: ReactNode
  rightPanel: ReactNode
  showLeftPanel?: boolean
  showRightPanel?: boolean
}

export function ThreePanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  showLeftPanel = true,
  showRightPanel = true,
}: ThreePanelLayoutProps) {
  return (
    <div className="flex h-full w-full">
      {/* Left Panel - Schema Tree */}
      {showLeftPanel && (
        <div className="w-64 flex-shrink-0">
          {leftPanel}
        </div>
      )}

      {/* Center Panel - Main Content */}
      <div className="flex-1 min-w-0">
        {centerPanel}
      </div>

      {/* Right Panel - Staging Changes */}
      {showRightPanel && (
        <div className="w-80 flex-shrink-0">
          {rightPanel}
        </div>
      )}
    </div>
  )
}
