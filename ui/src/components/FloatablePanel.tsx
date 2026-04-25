import React, { ReactNode, useState, useCallback, useRef, useEffect } from 'react'
import { Maximize2, Minimize2, X, Pin, PinOff } from 'lucide-react'

interface FloatablePanelProps {
  children: ReactNode
  title: string
  /** Default height when docked */
  defaultHeight?: number
  minHeight?: number
  maxHeight?: number
  storageKey?: string
  className?: string
}

interface FloatingState {
  isFloating: boolean
  x: number
  y: number
  width: number
  height: number
}

export function FloatablePanel({
  children,
  title,
  defaultHeight = 280,
  minHeight = 120,
  maxHeight = 600,
  storageKey,
  className = '',
}: FloatablePanelProps) {
  const [height, setHeight] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`${storageKey}-h`)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= minHeight && parsed <= maxHeight) return parsed
      }
    }
    return defaultHeight
  })

  const [floating, setFloating] = useState<FloatingState>({
    isFloating: false,
    x: 100,
    y: 100,
    width: 900,
    height: 500,
  })

  const [isPinned, setIsPinned] = useState(true)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Vertical resize (docked mode)
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizeRef.current = { startY: e.clientY, startH: height }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = ev.clientY - resizeRef.current.startY
      const newH = Math.max(minHeight, Math.min(maxHeight, resizeRef.current.startH + delta))
      setHeight(newH)
    }

    const onMouseUp = () => {
      resizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (storageKey) localStorage.setItem(`${storageKey}-h`, String(height))
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [height, minHeight, maxHeight, storageKey])

  // Float toggle
  const toggleFloat = useCallback(() => {
    setFloating(prev => ({
      ...prev,
      isFloating: !prev.isFloating,
      x: prev.isFloating ? prev.x : Math.max(50, window.innerWidth - 950),
      y: prev.isFloating ? prev.y : 80,
    }))
  }, [])

  // Drag floating panel
  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (!floating.isFloating) return
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: floating.x,
      origY: floating.y,
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setFloating(prev => ({ ...prev, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }))
    }

    const onMouseUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [floating.isFloating, floating.x, floating.y])

  if (floating.isFloating) {
    return (
      <div
        ref={panelRef}
        className="fixed z-[9999] flex flex-col rounded-lg shadow-2xl border"
        style={{
          left: floating.x,
          top: floating.y,
          width: floating.width,
          height: floating.height,
          background: '#FFFFFF',
          borderColor: '#E2E8F0',
          overflow: 'hidden',
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-3 py-1.5 cursor-move select-none"
          style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
          onMouseDown={handleDragMouseDown}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>{title}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsPinned(!isPinned)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }} title={isPinned ? 'Détacher' : 'Épingler'}>
              {isPinned ? <Pin size={12} strokeWidth={1.5} /> : <PinOff size={12} strokeWidth={1.5} />}
            </button>
            <button onClick={toggleFloat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }} title="Ancrer">
              <Minimize2 size={12} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    )
  }

  // Docked mode with vertical resize handle
  return (
    <div
      ref={panelRef}
      className={`relative flex flex-col ${className}`}
      style={{ height, flexShrink: 0 }}
    >
      {/* Resize handle at top */}
      <div
        className="absolute top-0 left-0 right-0 z-50"
        style={{ height: 6, cursor: 'row-resize' }}
        onMouseDown={handleResizeMouseDown}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.3)' }}
        onMouseLeave={(e) => { if (!resizeRef.current) e.currentTarget.style.background = 'transparent' }}
      />

      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', marginTop: 6 }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>{title}</span>
        <div className="flex items-center gap-1">
          <button onClick={toggleFloat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }} title="Flotter">
            <Maximize2 size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
