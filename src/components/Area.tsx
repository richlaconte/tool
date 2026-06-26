import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import './area.css'

type AreaProps = {
  area: {
    x: number
    y: number
  }
  index: number
  isNewest: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onMove: (index: number, x: number, y: number) => void
}

const Area = ({
  area,
  index,
  isNewest,
  textareaRef,
  onMove,
}: AreaProps) => {
  const dragOffset = useRef({
    x: 0,
    y: 0,
  })

  const isDragging = useRef(false)

  useEffect(() => {
    if (!isNewest) return

    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [isNewest, textareaRef])

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()

    isDragging.current = true

    dragOffset.current = {
      x: e.clientX - area.x,
      y: e.clientY - area.y,
    }

    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isDragging.current) return

    const x = e.clientX - dragOffset.current.x
    const y = e.clientY - dragOffset.current.y

    onMove(index, x, y)
  }

  const handlePointerEnd = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    isDragging.current = false

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleInput = (
    e: React.FormEvent<HTMLTextAreaElement>
  ) => {
    const textarea = e.currentTarget

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  return (
    <div
      className="area"
      style={{
        position: 'absolute',
        border: '1px dashed',
        borderRadius: '5px',
        width: '200px',
        minHeight: '28px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: '4px',
        left: area.x,
        top: area.y,
      }}
    >
      <div
        className="draggy"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        X
      </div>

      <textarea
        ref={isNewest ? textareaRef : null}
        rows={1}
        onInput={handleInput}
      />
    </div>
  )
}

export default Area