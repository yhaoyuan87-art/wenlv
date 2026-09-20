import { useEffect, useRef, useState } from 'react'
import { CityScene } from '../three/CityScene.js'
import { shouldFallback3D } from '../three/webgl.js'
import WebGLFallback from '../components/WebGLFallback.jsx'
import { useStore } from '../store/useStore.js'
import { poisByDistrict, getCategory } from '../data/pois.js'
import { getDistrict } from '../data/districts.js'

const VIEWS = [
  { id: 'pano', label: '全景' },
  { id: 'top', label: '俯视' },
  { id: 'reset', label: '重置' }
]

export default function CityLayer() {
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const [view, setView] = useState('pano')
  // 地标预览卡：点地标弹出该区代表景点速览
  const [preview, setPreview] = useState(null)
  // WebGL 不可用（或 ?nowebgl=1 强制）时不构造 3D 场景，直接渲染兜底 UI
  const [unsupported, setUnsupported] = useState(() => shouldFallback3D())
  // GLB 城市模型异步加载指示
  const [modelReady, setModelReady] = useState(false)

  useEffect(() => {
    if (unsupported) return undefined
    const store = useStore.getState()
    let scene = null
    try {
      scene = new CityScene(hostRef.current, {
        onSelectDistrict: (id) => {
          if (!id) return
          useStore.getState().selectDistrict(id)
        },
        onSelectLandmark: (lm) => {
          if (lm.districtId) useStore.getState().selectDistrict(lm.districtId)
          setPreview({ name: lm.name, districtId: lm.districtId || null })
        },
        onModelReady: () => setModelReady(true)
      })
      scene.setReduceMotion(store.reduceMotion)
      scene.setTheme()
      scene.setPanelInsets(store.panelInsets)
      if (store.districtId) scene.setSelected(store.districtId)
    } catch (err) {
      // 创建渲染器 / 场景抛错时同样走兜底，避免整页白屏
      console.error('[CityLayer] 3D 场景初始化失败，已降级为提示卡片', err)
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
    let prev = useStore.getState().districtId
    let prevToken = useStore.getState().resetViewToken
    let prevMotion = useStore.getState().reduceMotion
    let prevTheme = useStore.getState().theme
    let prevInsets = useStore.getState().panelInsets
    const unsub = useStore.subscribe((s) => {
      const scene = sceneRef.current
      if (!scene) return
      if (s.districtId !== prev) {
        prev = s.districtId
        scene.setSelected(s.districtId)
      }
      if (s.panelInsets !== prevInsets) {
        prevInsets = s.panelInsets
        scene.setPanelInsets(s.panelInsets)
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

  if (unsupported) return <WebGLFallback layer="city" />

  const previewDistrict = preview && preview.districtId ? getDistrict(preview.districtId) : null
  const previewPois = preview && preview.districtId ? poisByDistrict(preview.districtId).slice(0, 3) : []

  return (
    <div className="three-host" ref={hostRef}>
      {!modelReady && (
        <div className="city-model-loading">
          <span>城市模型加载中…</span>
        </div>
      )}
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

      {preview && (
        <div className="city-preview" key={preview.name}>
          <div className="city-preview-head">
            <b>{preview.name}</b>
            <button className="city-preview-close" onClick={() => setPreview(null)} aria-label="关闭">
              ×
            </button>
          </div>
          {previewDistrict && <span className="city-preview-sub">{previewDistrict.name} · {previewDistrict.intro.slice(0, 24)}…</span>}
          {previewPois.length > 0 && (
            <div className="city-preview-pois">
              {previewPois.map((p) => (
                <button key={p.poiId} onClick={() => useStore.getState().openDrawer(p.poiId)}>
                  <i className="cat-dot" style={{ background: getCategory(p.category).color }} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {previewDistrict && (
            <button
              className="city-preview-go"
              onClick={() => {
                useStore.getState().setPoiScope('district')
                useStore.getState().goLayer('poi')
              }}
            >
              看本区全部景点
            </button>
          )}
        </div>
      )}
    </div>
  )
}
