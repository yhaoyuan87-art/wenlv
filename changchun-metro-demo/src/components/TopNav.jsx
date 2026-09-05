import { useMemo, useRef, useState, useEffect } from 'react'
import { useStore, LAYERS } from '../store/useStore.js'
import { districts } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { pois, getCategory } from '../data/pois.js'

function buildIndex() {
  const out = []
  districts.forEach((d) => out.push({ type: 'district', id: d.districtId, name: d.name, sub: '区域', color: d.color }))
  metroLines.forEach((l) => {
    out.push({ type: 'line', id: l.lineId, name: l.name, sub: `${l.direction}`, color: l.color })
    l.stations.forEach((s) => out.push({ type: 'station', id: s.stationId, name: s.name, sub: `${l.shortName} · 站点`, color: l.color }))
  })
  pois.forEach((p) => out.push({ type: 'poi', id: p.poiId, name: p.name, sub: getCategory(p.category).name + ' · 景点', color: getCategory(p.category).color }))
  return out
}

const INDEX = buildIndex()

export default function TopNav() {
  const layer = useStore((s) => s.layer)
  const goLayer = useStore((s) => s.goLayer)
  const toggleLegend = useStore((s) => s.toggleLegend)
  const reduceMotion = useStore((s) => s.reduceMotion)
  const toggleReduceMotion = useStore((s) => s.toggleReduceMotion)

  const [kw, setKw] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [toast, setToast] = useState('')
  // mSearch：手机端把搜索框铺满顶栏的浮层态
  const [mSearch, setMSearch] = useState(false)
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const toastTimer = useRef(null)

  const results = useMemo(() => {
    const q = kw.trim()
    if (!q) return []
    return INDEX.filter((it) => it.name.includes(q) || it.sub.includes(q)).slice(0, 12)
  }, [kw])

  // 用 pointerdown 而不是 mousedown：触屏设备上 mousedown 可能不触发
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
        setMSearch(false)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [])

  // 手机端展开搜索浮层后自动聚焦
  useEffect(() => {
    if (mSearch && inputRef.current) inputRef.current.focus()
  }, [mSearch])

  const closeSearch = () => {
    setMSearch(false)
    setOpen(false)
    setKw('')
  }

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const jump = (item) => {
    closeSearch()
    const s = useStore.getState()
    if (item.type === 'district') {
      s.selectDistrict(item.id)
      s.goLayer('city')
    } else if (item.type === 'line') {
      s.selectLine(item.id)
      s.goLayer('metro')
    } else if (item.type === 'station') {
      s.selectStation(item.id)
      s.goLayer('metro')
    } else {
      s.openDrawer(item.id)
      s.goLayer('poi')
    }
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('链接已复制，分享给同行的人吧')
    } catch {
      showToast(window.location.href)
    }
  }

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length) setActiveIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length) setActiveIdx((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) jump(results[activeIdx])
    } else if (e.key === 'Escape') {
      closeSearch()
    }
  }

  return (
    <header className={'topnav' + (mSearch ? ' searching' : '')}>
      <div className="brand">
        <span className="brand-mark" />
        <div className="brand-text">
          <b>长春地铁文旅</b>
          <span>四层联动探索平台 · Demo</span>
        </div>
      </div>

      <nav className="layer-tabs" aria-label="四层导航">
        {LAYERS.map((l, i) => (
          <button
            key={l.id}
            className={'layer-tab' + (layer === l.id ? ' on' : '')}
            onClick={() => goLayer(l.id)}
            aria-current={layer === l.id ? 'page' : undefined}
          >
            <em>{i + 1}</em>
            {l.label}
          </button>
        ))}
      </nav>

      <div className="nav-right">
        <button
          className={'icon-btn theme-toggle' + (theme === 'light' ? ' light' : '')}
          onClick={toggleTheme}
          title={theme === 'light' ? '切换到夜间主题' : '切换到白天主题'}
          aria-label={theme === 'light' ? '切换到夜间主题' : '切换到白天主题'}
          aria-pressed={theme === 'light'}
        >
          <span className="theme-glyph">{theme === 'light' ? '🌙' : '☀️'}</span>
          <span className="theme-label">{theme === 'light' ? '夜间' : '白天'}</span>
        </button>
        <button className="icon-btn nav-search-btn" onClick={() => setMSearch(true)} aria-label="打开搜索">
          搜索
        </button>
        <div className="search-box" ref={boxRef}>
          <input
            ref={inputRef}
            value={kw}
            placeholder="搜索区域 / 线路 / 站点 / 景点"
            onChange={(e) => {
              setKw(e.target.value)
              setActiveIdx(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onSearchKey}
            aria-label="全局搜索"
          />
          <button className="search-cancel" onClick={closeSearch}>
            取消
          </button>
          {open && results.length > 0 && (
            <div className="search-pop" role="listbox">
              {results.map((r, i) => (
                <button
                  key={r.type + r.id}
                  className={'search-item' + (i === activeIdx ? ' hl' : '')}
                  role="option"
                  aria-selected={i === activeIdx}
                  onClick={() => jump(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <i style={{ background: r.color }} />
                  <b>{r.name}</b>
                  <span>{r.sub}</span>
                </button>
              ))}
            </div>
          )}
          {open && kw.trim() && results.length === 0 && (
            <div className="search-pop empty">没有匹配结果</div>
          )}
        </div>
        <button className="icon-btn" onClick={share} title="复制当前视图链接">
          分享
        </button>
        <button className={'icon-btn motion-only' + (reduceMotion ? ' on' : '')} onClick={toggleReduceMotion} title="减少动效">
          {reduceMotion ? '动效关' : '动效开'}
        </button>
        <button className="icon-btn" onClick={toggleLegend} title="图例与帮助">
          图例
        </button>
      </div>
      {toast && <div className="nav-toast">{toast}</div>}
    </header>
  )
}
