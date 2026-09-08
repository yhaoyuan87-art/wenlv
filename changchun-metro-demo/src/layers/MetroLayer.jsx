import { useEffect, useRef, useState } from 'react'
import { MetroScene } from '../three/MetroScene.js'
import { shouldFallback3D } from '../three/webgl.js'
import WebGLFallback from '../components/WebGLFallback.jsx'
import { useStore } from '../store/useStore.js'

const VIEWS = [
  { id: 'pano', label: '全景' },
  { id: 'top', label: '俯视' },
  { id: 'reset', label: '重置' }
]

export default function MetroLayer() {
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const [view, setView] = useState('pano')
  // WebGL 不可用（或 ?nowebgl=1 强制）时不构造 3D 场景，直接渲染兜底 UI
  const [unsupported, setUnsupported] = useState(() => shouldFallback3D())

  useEffect(() => {
    if (unsupported) return undefined
    const store = useStore.getState()
    let scene = null
    try {
      scene = new MetroScene(hostRef.current, {
        onSelectStation: (stationId) => useStore.getState().selectStation(stationId),
        onSelectLine: (lineId) => useStore.getState().selectLine(lineId)
      })
      scene.setReduceMotion(store.reduceMotion)
      scene.setTheme()
      scene.setPanelInsets(store.panelInsets)
      if (store.lineId) scene.highlightLine(store.lineId, store.stationId)
      if (store.stationId) scene.focusStation(store.stationId)
    } catch (err) {
      // 创建渲染器 / 场景抛错时同样走兜底，避免整页白屏
      console.error('[MetroLayer] 3D 场景初始化失败，已降级为提示卡片', err)
      if (scene) {
        try {
          scene.dispose()
        } catch {
          /* 忽略：构造已失败，析构异常无需处理 */
        }
      }
      // 用微任务异步切换：不在 effect 里同步 setState，避免触发级联渲染
      queueMicrotask(() => setUnsupported(true))
      return undefined
    }
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [unsupported])

  // 降级态同步到 store：详情面板会让位，否则在 ≤900px 断点它会盖住整个兜底卡片
  useEffect(() => {
    if (!unsupported) return undefined
    useStore.getState().setWebglUnsupported(true)
    return () => useStore.getState().setWebglUnsupported(false)
  }, [unsupported])

  useEffect(() => {
    let prevLine = useStore.getState().lineId
    let prevStation = useStore.getState().stationId
    let prevMotion = useStore.getState().reduceMotion
    let prevTheme = useStore.getState().theme
    let prevInsets = useStore.getState().panelInsets
    const unsub = useStore.subscribe((s) => {
      const scene = sceneRef.current
      if (!scene) return
      if (s.panelInsets !== prevInsets) {
        prevInsets = s.panelInsets
        scene.setPanelInsets(s.panelInsets)
      }
      if (s.lineId !== prevLine || s.stationId !== prevStation) {
        prevLine = s.lineId
        prevStation = s.stationId
        scene.highlightLine(s.lineId, s.stationId)
        if (s.stationId) scene.focusStation(s.stationId)
        else if (s.lineId) scene.focusLine(s.lineId)
      }
      if (s.reduceMotion !== prevMotion) {
        prevMotion = s.reduceMotion
        scene.setReduceMotion(s.reduceMotion)
      }
      if (s.theme !== prevTheme) {
        prevTheme = s.theme
        scene.setTheme()
      }
    })
    return unsub
  }, [])

  const setCamera = (mode) => {
    const scene = sceneRef.current
    if (!scene) return
    setView(mode)
    if (mode === 'top') scene.topView()
    else scene.resetView()
  }

  if (unsupported) return <WebGLFallback layer="metro" />

  return (
    <div className="three-host" ref={hostRef}>
      <div className="view-controls">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={'view-btn' + (view === v.id ? ' on' : '')}
            onClick={() => setCamera(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
