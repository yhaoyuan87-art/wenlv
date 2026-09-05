import { useEffect, useRef, useState } from 'react'
import { CityScene } from '../three/CityScene.js'
import { useStore } from '../store/useStore.js'

const VIEWS = [
  { id: 'pano', label: '全景' },
  { id: 'top', label: '俯视' },
  { id: 'reset', label: '重置' }
]

export default function CityLayer() {
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const [view, setView] = useState('pano')

  useEffect(() => {
    const store = useStore.getState()
    const scene = new CityScene(hostRef.current, {
      onSelectDistrict: (id) => {
        if (!id) return
        useStore.getState().selectDistrict(id)
      },
      onSelectLandmark: (lm) => {
        if (lm.districtId) useStore.getState().selectDistrict(lm.districtId)
      }
    })
    scene.setReduceMotion(store.reduceMotion)
    scene.setTheme()
    if (store.districtId) scene.setSelected(store.districtId)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    let prev = useStore.getState().districtId
    let prevToken = useStore.getState().resetViewToken
    let prevMotion = useStore.getState().reduceMotion
    let prevTheme = useStore.getState().theme
    const unsub = useStore.subscribe((s) => {
      const scene = sceneRef.current
      if (!scene) return
      if (s.districtId !== prev) {
        prev = s.districtId
        scene.setSelected(s.districtId)
      }
      if (s.resetViewToken !== prevToken) {
        prevToken = s.resetViewToken
        scene.resetView()
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
