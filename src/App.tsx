import { useEffect, useRef, useState } from 'react'

import Area from './components/Area'

type AreaPosition = {
  x: number
  y: number
}

function App() {
  const [areas, setAreas] = useState<AreaPosition[]>([])
  const newestTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement

      if (target.id !== 'canvas') return

      e.preventDefault()

      setAreas((prev) => [
        ...prev,
        {
          x: e.clientX,
          y: e.clientY,
        },
      ])
    }

    document.addEventListener('pointerdown', handleClick)

    return () => {
      document.removeEventListener('pointerdown', handleClick)
    }
  }, [])

  const moveArea = (index: number, x: number, y: number) => {
    setAreas((prev) =>
      prev.map((area, areaIndex) =>
        areaIndex === index
          ? {
              ...area,
              x,
              y,
            }
          : area
      )
    )
  }

  return (
    <div id="canvas">
      {areas.map((area, index) => (
        <Area
          key={index}
          index={index}
          area={area}
          isNewest={index === areas.length - 1}
          textareaRef={newestTextareaRef}
          onMove={moveArea}
        />
      ))}
    </div>
  )
}

export default App