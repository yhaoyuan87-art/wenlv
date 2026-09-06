import { useEffect, useRef, useState } from 'react'
import { MetroScene } from '../three/MetroScene.js'
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

  useEffect(() => {
    const store = useStore.getState()
    const scene = new MetroScene(hostRef.current, {
      onSelectStation: (stationId) => useStore.getState().selectStation(stationId),
      onSelectLine: (lineId) => useStore.getState().selectLine(lineId)
    })
    scene.setReduceMotion(store.reduceMotion)
    scene.setTheme()
    scene.setPanelInsets(store.panelInsets)
    if (store.lineId) scene.highlightLine(store.lineId, store.stationId)
    if (store.stationId) scene.focusStation(store.stationId)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

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
