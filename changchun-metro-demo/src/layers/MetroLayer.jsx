import { useEffect, useMemo, useRef, useState } from 'react'
import { MetroScene } from '../three/MetroScene.js'
import { shouldFallback3D } from '../three/webgl.js'
import WebGLFallback from '../components/WebGLFallback.jsx'
import { useStore } from '../store/useStore.js'
import { buildChainRoute, findRoute, stationOptions } from '../data/routePlanner.js'
import { getTheme, themePois } from '../data/themes.js'

const VIEWS = [
  { id: 'pano', label: '全景' },
  { id: 'top', label: '俯视' },
  { id: 'reset', label: '重置' }
]

const STRATS = [
  { id: 'fast', label: '最快' },
  { id: 'transfer', label: '少换乘' },
  { id: 'stops', label: '少站点' }
]

export default function MetroLayer() {
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const [view, setView] = useState('pano')
  // WebGL 不可用（或 ?nowebgl=1 强制）时不构造 3D 场景，直接渲染兜底 UI
  const [unsupported, setUnsupported] = useState(() => shouldFallback3D())

  // ---- 路径规划 / 跟随 / 主题一日线的 UI 状态 ----
  const themeId = useStore((s) => s.themeId)
  const themeMeta = useMemo(() => (themeId ? getTheme(themeId) : null), [themeId])
  const stationId = useStore((s) => s.stationId)
  const myRoute = useStore((s) => s.myRoute)
  const setMyRoute = useStore((s) => s.setMyRoute)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [originId, setOriginId] = useState(null)
  const [destId, setDestId] = useState(null)
  const [route, setRoute] = useState(null)
  const [follow, setFollow] = useState(false)
  const [section, setSection] = useState(false)
  const [roam, setRoam] = useState(false)
  const [winter, setWinter] = useState(false)
  const [strategy, setStrategy] = useState('fast')
  // 策略要被 render 外的回调（3D 点选）读到，镜像成 ref
  const strategyRef = useRef('fast')
  // 主题路线纯派生：景点站串联（相邻段 findRoute + 同线合并），无需 effect/state
  const themeRoute = useMemo(() => {
    if (!themeMeta) return null
    const stationIds = themePois(themeMeta.themeId)
      .map((p) => p.stationIds?.[0])
      .filter(Boolean)
    return buildChainRoute(stationIds, themeMeta.color)
  }, [themeMeta])
  // 场景回调与 zustand 订阅是「 render 外」的入口，读不到最新 state 闭包，
  // 用一个快照 ref 在 effect 里同步（不违反 render 期间不可写 ref 的约束）
  const latestRef = useRef({ open: false, origin: null, dest: null, route: null, themeRoute: null, myRoute: null })
  useEffect(() => {
    latestRef.current = { open: plannerOpen, origin: originId, dest: destId, route, themeRoute, myRoute }
  }, [plannerOpen, originId, destId, route, themeRoute, myRoute])

  const options = useMemo(() => stationOptions(), [])

  // follow 态不镜像成 ref：场景上的 followTrain 本身就是真相源
  const isFollowing = () => !!sceneRef.current?.followTrain

  /**
   * 统一路线上屏入口，优先级：规划路线 > 我的路线 > 主题一日线 > 清空。
   * 传 plannerRoute 用于「本轮 setState 还没进 ref」的同步调用场景。
   */
  const showActiveRoute = (plannerRoute) => {
    const scene = sceneRef.current
    if (!scene) return
    const active = plannerRoute !== undefined ? plannerRoute : latestRef.current.route
    const target = active || latestRef.current.myRoute || latestRef.current.themeRoute
    if (target) scene.showRoute(target)
    else scene.clearRoute()
  }

  // 主题 / 我的路线变化（含清空）→ 重上屏（规划路线仍在时自动让位）
  useEffect(() => {
    showActiveRoute()
  }, [themeRoute, myRoute])

  /** 把 3D 点击的站点填进起/终点：无起点→起点；已有双点→重设起点 */
  const pickPlannerStation = (stationId) => {
    const { origin, dest } = latestRef.current
    if (!origin || (origin && dest)) {
      setOriginId(stationId)
      setDestId(null)
      setRoute(null)
      showActiveRoute(null)
      return
    }
    if (stationId === origin) return
    setDestId(stationId)
    const r = findRoute(origin, stationId, strategyRef.current)
    setRoute(r)
    showActiveRoute(r)
  }

  /** 由下拉框改动触发：双点齐了就算路，否则清掉旧路线 */
  const applyRoute = (o, d) => {
    const r = o && d ? findRoute(o, d, strategyRef.current) : null
    setRoute(r)
    showActiveRoute(r)
  }

  /** 切换规划策略：按当前起终点立即重算 */
  const changeStrategy = (id) => {
    setStrategy(id)
    strategyRef.current = id
    if (originId && destId) {
      const r = findRoute(originId, destId, id)
      setRoute(r)
      showActiveRoute(r)
    }
  }

  const swapRoute = () => {
    if (!originId || !destId) return
    setOriginId(destId)
    setDestId(originId)
    applyRoute(destId, originId)
  }

  const clearPlanner = () => {
    setOriginId(null)
    setDestId(null)
    setRoute(null)
    showActiveRoute(null) // 规划清掉后，主题一日线若仍选中会自动回归
  }

  const closePlanner = () => {
    setPlannerOpen(false)
    clearPlanner()
  }

  useEffect(() => {
    if (unsupported) return undefined
    const store = useStore.getState()
    let scene = null
    try {
      scene = new MetroScene(hostRef.current, {
        onSelectStation: (stationId) => {
          // 规划面板开着：点击 3D 站点 = 快速选点；否则走常规「选中站点」链路
          if (latestRef.current.open) pickPlannerStation(stationId)
          else useStore.getState().selectStation(stationId)
        },
        onSelectLine: (lineId) => useStore.getState().selectLine(lineId),
        onFollowChange: (v) => setFollow(v),
        onSectionChange: (v) => setSection(v),
        onRoamChange: (v) => setRoam(v),
        // 点空白处退出聚焦：清掉选中的线路/站点（规划面板打开时不干预）
        onEmptyClick: () => {
          if (latestRef.current.open) return
          const s = useStore.getState()
          if (s.lineId || s.stationId) s.selectLine(null)
        }
      })
      scene.setReduceMotion(store.reduceMotion)
      scene.setTheme()
      scene.setPanelInsets(store.panelInsets)
      if (store.lineId) scene.highlightLine(store.lineId, store.stationId)
      if (store.stationId) scene.focusStation(store.stationId)
      // 挂载时已有激活路线（带 ?theme= 直进 / 规划态残留 / 收藏路线）则立即上屏
      const activeRoute = latestRef.current.route || latestRef.current.myRoute || latestRef.current.themeRoute
      if (activeRoute) scene.showRoute(activeRoute)
      // 入场运镜：城市层带区划下来 → 区划上空下潜；裸进 → 电影式开场（每会话一次）
      if (!store.stationId && !store.lineId) {
        if (store.districtId) scene.playDive(store.districtId)
        else scene.playIntro()
      }
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
        // 常规选中链路与规划/跟随互斥：只清规划路线（主题一日线保留），再走聚焦
        if (latestRef.current.route || isFollowing()) {
          scene.exitFollow()
          if (latestRef.current.route) {
            setRoute(null)
            showActiveRoute(null)
          }
        }
        scene.highlightLine(s.lineId, s.stationId)
        if (scene.section) {
          // 剖面模式跟随选中切换：换站点重建剖面（内部自带入地镜头）
          if (s.stationId) scene.enterSection(s.stationId)
          else scene.exitSection()
        } else if (s.stationId) scene.focusStation(s.stationId)
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

  // ESC 退出跟随（抽屉 / 图例的 ESC 由 App 层处理，互不冲突）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      sceneRef.current?.exitFollow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 交互打点：任何点击 / 滚轮 / 按键都会重置闲置计时并退出漫游
  useEffect(() => {
    const mark = () => sceneRef.current?.markInteraction()
    window.addEventListener('pointerdown', mark, true)
    window.addEventListener('wheel', mark, { capture: true, passive: true })
    window.addEventListener('keydown', mark, true)
    return () => {
      window.removeEventListener('pointerdown', mark, true)
      window.removeEventListener('wheel', mark, { capture: true })
      window.removeEventListener('keydown', mark, true)
    }
  }, [])

  // 规划面板 / 剖面打开期间不进入自由漫游
  useEffect(() => {
    sceneRef.current?.setRoamAllowed(!(plannerOpen || section))
  }, [plannerOpen, section])

  // 组件卸载时把跟随态复位（下次进层是全新场景，无需额外处理）
  useEffect(() => () => setFollow(false), [])

  const toggleWinter = () => {
    const next = !winter
    setWinter(next)
    sceneRef.current?.setWinter(next)
  }

  const setCamera = (mode) => {
    const scene = sceneRef.current
    if (!scene) return
    setView(mode)
    // 切换全局视图时退出剖面（exitSection 内部无镜头操作，交由视图按钮接管）
    scene.exitSection()
    if (mode === 'top') scene.topView()
    else scene.resetView()
  }

  const toggleSection = () => {
    const scene = sceneRef.current
    if (!scene) return
    if (scene.section) {
      scene.exitSection()
      setView('reset')
      scene.resetView()
    } else if (stationId) {
      scene.enterSection(stationId)
    }
  }

  if (unsupported) return <WebGLFallback layer="metro" />

  const renderStationOptions = () =>
    options.map((g) => (
      <optgroup key={g.lineId} label={g.shortName}>
        {g.stations.map((st) => (
          <option key={st.stationId} value={st.stationId}>
            {st.name}
          </option>
        ))}
      </optgroup>
    ))

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
        <button className={'view-btn' + (plannerOpen ? ' on' : '')} onClick={() => (plannerOpen ? closePlanner() : setPlannerOpen(true))}>
          规划
        </button>
        <button
          className={'view-btn' + (section ? ' on' : '')}
          disabled={!stationId && !section}
          title={!stationId && !section ? '先在 3D 中选择一个站点' : '站体剖面：B1 站厅 / B2 站台'}
          onClick={toggleSection}
        >
          剖面
        </button>
        <button className={'view-btn' + (winter ? ' on' : '')} onClick={toggleWinter} title="冰雪模式：飘雪 + 地面结霜">
          冬季
        </button>
      </div>

      {plannerOpen && (
        <div className="route-planner">
          <div className="route-planner-head">
            <b>站到站路径规划</b>
            <button className="route-close" onClick={closePlanner} aria-label="关闭路径规划">
              ×
            </button>
          </div>
          <div className="route-fields">
            <select
              className="route-select"
              value={originId || ''}
              onChange={(e) => {
                const v = e.target.value || null
                setOriginId(v)
                applyRoute(v, destId)
              }}
            >
              <option value="" disabled>
                选择起点
              </option>
              {renderStationOptions()}
            </select>
            <button className="route-swap" onClick={swapRoute} disabled={!originId || !destId} title="交换起终点">
              交换
            </button>
            <select
              className="route-select"
              value={destId || ''}
              onChange={(e) => {
                const v = e.target.value || null
                setDestId(v)
                applyRoute(originId, v)
              }}
            >
              <option value="" disabled>
                选择终点
              </option>
              {renderStationOptions()}
            </select>
          </div>
          <div className="route-strats">
            {STRATS.map((s) => (
              <button
                key={s.id}
                className={'chip' + (strategy === s.id ? ' on' : '')}
                onClick={() => changeStrategy(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="route-hint">提示：开启规划后，直接点击 3D 站点也能依次设为起、终点</p>
        </div>
      )}

      {route && (
        <div className="route-card">
          <div className="route-card-head">
            <b>行程方案</b>
            <span className="route-sum">
              约 {route.minutes} 分钟 · {route.stops} 站 · 换乘 {route.transfers} 次
            </span>
            <button className="route-mini-btn" onClick={clearPlanner}>
              清除
            </button>
          </div>
          <div className="route-steps">
            {route.segments.map((seg, i) => (
              <div key={seg.lineId + i}>
                {i > 0 &&
                  (seg.lineId !== route.segments[i - 1].lineId ? (
                    <div className="route-transfer">在 {seg.boardName} 站内换乘</div>
                  ) : (
                    <div className="route-back">在 {seg.boardName} 原线折返</div>
                  ))}
                <div
                  className="route-seg"
                  onMouseEnter={() => sceneRef.current?.emphasizeSegment(i)}
                  onMouseLeave={() => sceneRef.current?.emphasizeSegment(null)}
                >
                  <span className="route-badge" style={{ background: seg.color }}>
                    {seg.shortName.replace('号线', '')}
                  </span>
                  <div className="route-seg-main">
                    <b>
                      {seg.boardName} → {seg.alightName}
                    </b>
                    <span>
                      开往 {seg.toward} 方向 · 乘坐 {seg.stops} 站
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!route && myRoute && (
        <div className="route-card my-route-card">
          <div className="route-card-head">
            <b style={{ color: 'var(--accent)' }}>我的路线</b>
            <span className="route-sum">
              {myRoute.markers.length} 个收藏点 · 约 {myRoute.minutes} 分钟 · 换乘 {myRoute.transfers} 次
            </span>
            <button className="route-mini-btn" onClick={() => setMyRoute(null)}>
              退出路线
            </button>
          </div>
          <div className="theme-mini-stops">
            {myRoute.markers.map((mk, i) => {
              const st = myRoute.stations.find((x) => x.stationId === mk.stationId)
              return (
                <span key={mk.stationId + i} className="theme-mini-stop">
                  <i style={{ background: 'var(--accent)' }}>{mk.text}</i>
                  {st ? st.name : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {!route && !myRoute && themeRoute && themeMeta && (
        <div className="route-card theme-card-mini" style={{ borderColor: themeMeta.color }}>
          <div className="route-card-head">
            <b style={{ color: themeMeta.color }}>{themeMeta.name}</b>
            <span className="route-sum">
              {themeMeta.poiIds.length} 个景点 · 约 {themeRoute.minutes} 分钟 · 换乘 {themeRoute.transfers} 次
            </span>
            <button className="route-mini-btn" onClick={() => useStore.getState().setTheme(null)}>
              退出主题
            </button>
          </div>
          <p className="theme-mini-summary">{themeMeta.summary}</p>
          <div className="theme-mini-stops">
            {themeRoute.markers.map((mk, i) => {
              const st = themeRoute.stations.find((x) => x.stationId === mk.stationId)
              return (
                <span key={mk.stationId + i} className="theme-mini-stop">
                  <i style={{ background: themeMeta.color }}>{mk.text}</i>
                  {st ? st.name : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {follow && (
        <button className="follow-chip" onClick={() => sceneRef.current?.exitFollow()}>
          <i />
          跟随列车中 · 点击画面或按 ESC 退出
        </button>
      )}

      {roam && (
        <button className="follow-chip roam-chip" onClick={() => sceneRef.current?.markInteraction()}>
          <i />
          自由漫游中 · 任意操作接管镜头
        </button>
      )}
    </div>
  )
}
