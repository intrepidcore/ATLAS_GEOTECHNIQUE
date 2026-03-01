/**
 * React Wrapper pour le composant ResizablePanel
 * 
 * @version 3.5.2
 * 
 * Usage:
 * ```tsx
 * <ResizablePanelReact
 *   direction="horizontal"
 *   minSize={200}
 *   maxSize={500}
 *   defaultSize={300}
 *   storageKey="atlas-left-panel-width"
 * >
 *   {children}
 * </ResizablePanelReact>
 * ```
 */

import React, { useRef, useEffect, useState, ReactNode, useCallback } from 'react'

export interface ResizablePanelProps {
  children: ReactNode
  /** Direction du redimensionnement: 'horizontal' (largeur) ou 'vertical' (hauteur) */
  direction: 'horizontal' | 'vertical'
  /** Taille minimale en pixels */
  minSize: number
  /** Taille maximale en pixels */
  maxSize: number
  /** Taille par défaut en pixels */
  defaultSize: number
  /** Clé localStorage pour persister la taille (optionnel) */
  storageKey?: string
  /** Position du handle: 'start' (gauche/haut) ou 'end' (droite/bas) */
  handlePosition?: 'start' | 'end'
  /** Callback appelé lors du redimensionnement */
  onResize?: (newSize: number) => void
  /** Classes CSS additionnelles */
  className?: string
}

export function ResizablePanelReact({
  children,
  direction,
  minSize,
  maxSize,
  defaultSize,
  storageKey,
  handlePosition = 'end',
  onResize,
  className = ''
}: ResizablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          return parsed
        }
      }
    }
    return defaultSize
  })
  const [isDragging, setIsDragging] = useState(false)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  // Gérer le début du drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
    startSizeRef.current = size
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [direction, size])

  // Gérer le mouvement du drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      let delta = currentPos - startPosRef.current
      
      // Inverser le delta si le handle est au début
      if (handlePosition === 'start') {
        delta = -delta
      }
      
      let newSize = startSizeRef.current + delta
      newSize = Math.max(minSize, Math.min(maxSize, newSize))
      
      setSize(newSize)
      if (onResize) {
        onResize(newSize)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      
      // Sauvegarder la taille
      if (storageKey) {
        localStorage.setItem(storageKey, String(size))
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, direction, handlePosition, minSize, maxSize, storageKey, size, onResize])

  // Style dynamique
  const panelStyle: React.CSSProperties = {
    position: 'relative',
    flexShrink: 0,
    ...(direction === 'horizontal' ? { width: size } : { height: size })
  }

  // Style du handle
  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    ...(direction === 'horizontal' 
      ? {
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          ...(handlePosition === 'end' ? { right: 0 } : { left: 0 })
        }
      : {
          left: 0,
          right: 0,
          height: 6,
          cursor: 'row-resize',
          ...(handlePosition === 'end' ? { bottom: 0 } : { top: 0 })
        }
    ),
    background: isDragging ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
    transition: isDragging ? 'none' : 'background 0.15s ease',
    zIndex: 50
  }

  const handleHoverStyle: React.CSSProperties = {
    ...handleStyle
  }

  return (
    <div
      ref={panelRef}
      className={`resizable-panel ${className}`}
      style={panelStyle}
    >
      {handlePosition === 'start' && (
        <div
          className="resizable-handle"
          style={handleStyle}
          onMouseDown={handleMouseDown}
          onMouseEnter={(e) => {
            if (!isDragging) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        />
      )}
      
      <div className="h-full w-full overflow-auto">
        {children}
      </div>
      
      {handlePosition === 'end' && (
        <div
          className="resizable-handle"
          style={handleStyle}
          onMouseDown={handleMouseDown}
          onMouseEnter={(e) => {
            if (!isDragging) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        />
      )}
    </div>
  )
}

export default ResizablePanelReact
