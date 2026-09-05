import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore.js'

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * 轻量 360° 全景查看器：拖拽平移 + 自动缓速巡游。
 * media.status === 'ready' 时加载真实全景图，否则用程序化占位画面（同样可拖拽预览）。
 */
export function PanoramaViewer({ media, title, seed }) {
  const hostRef = useRef(null)
  const state = useRef({ x: 0, dragging: false, lastX: 0, raf: 0 })
  const reduceMotion = useStore((s) => s.reduceMotion)
  const ready = media && media.status === 'ready' && media.panorama

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const st = state.current

    const tick = () => {
      st.raf = requestAnimationFrame(tick)
      if (!st.dragging && !reduceMotion) st.x -= 0.22
      el.style.backgroundPosition = `${st.x}px center`
    }
    tick()

    const down = (e) => {
      st.dragging = true
      st.lastX = e.clientX
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e) => {
      if (!st.dragging) return
      st.x -= e.clientX - st.lastX
      st.lastX = e.clientX
      el.style.backgroundPosition = `${st.x}px center`
    }
    const up = () => {
      st.dragging = false
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(st.raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [reduceMotion, ready])

  const h = hashCode(String(seed || title)) % 360
  const h2 = (h + 60) % 360
  const placeholderBg = `
    linear-gradient(180deg, hsla(${h2}, 45%, 55%, 0.5) 0%, hsla(${h2}, 45%, 55%, 0) 55%),
    radial-gradient(ellipse 60% 45% at 50% 78%, hsla(${h}, 40%, 45%, 0.55), hsla(${h}, 40%, 45%, 0) 70%),
    linear-gradient(180deg, hsl(${h2}, 38%, 22%), hsl(${h}, 45%, 13%))`

  const style = {
    backgroundImage: ready ? `url(${media.panorama})` : placeholderBg,
    backgroundSize: 'auto 100%',
    backgroundRepeat: 'repeat-x',
    cursor: 'grab'
  }

  return (
    <div
      ref={hostRef}
      className="pano-host"
      style={style}
      role="img"
      aria-label={`${title} 360° 全景${ready ? '' : '占位'}`}
    >
      <div className="pano-badge">
        {ready ? (
          <>
            <span className="pano-dot" /> 360° 全景 · 按住拖拽环视
          </>
        ) : (
          <>360° 位 · 素材待接入（可拖拽预览）</>
        )}
      </div>
    </div>
  )
}
