import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { districts, findDistrictByPoint } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { pois, getCategory } from '../data/pois.js'

/** 结果分组：顺序即下拉列表里的展示顺序 */
const GROUPS = [
  { type: 'district', label: '分区' },
  { type: 'line', label: '线路' },
  { type: 'station', label: '站点' },
  { type: 'poi', label: '景点' }
]

/** 下拉里最多展示的结果条数 */
const MAX_RESULTS = 8

const LISTBOX_ID = 'global-search-listbox'

const optionId = (index) => `global-search-option-${index}`

/** 站点 / 景点坐标落在哪个分区，用于结果里的次要说明 */
function districtNameAt(x, y) {
  const d = findDistrictByPoint(x, y)
  return d ? d.name : ''
}

/**
 * 构建一次性扁平索引：覆盖分区 / 线路 / 站点 / 景点四类对象。
 * 每项字段：
 *  - type/id：用于跳转
 *  - name：主标题
 *  - aliases：参与强匹配的别名（优先于正文匹配）
 *  - sub：次要说明（线路名、所属分区…）
 *  - color：左侧圆点（沿用数据自带的主题色）
 *  - key：参与弱匹配的扩展文本（类别、方位、标签…）
 */
function buildIndex() {
  const out = []
  districts.forEach((d) => {
    out.push({
      type: 'district',
      id: d.districtId,
      name: d.name,
      aliases: [d.name],
      color: d.color,
      sub: `区域 · ${d.position}`,
      key: `${d.name} 分区 区域 ${d.position} ${d.intro || ''}`
    })
  })
  metroLines.forEach((l) => {
    out.push({
      type: 'line',
      id: l.lineId,
      name: l.name,
      // 短名放前面：用户更常输入「3号线」而不是「地铁3号线」
      aliases: [l.shortName, l.name],
      color: l.color,
      sub: `${l.shortName} · ${l.stations.length} 站`,
      key: `${l.name} ${l.shortName} 线路 地铁 ${l.direction}`
    })
    l.stations.forEach((s) => {
      const area = districtNameAt(s.x, s.y)
      out.push({
        type: 'station',
        id: s.stationId,
        name: s.name,
        aliases: [s.name, `${s.name}站`],
        color: l.color,
        sub: `${l.shortName}${area ? ' · ' + area : ''}`,
        key: `${s.name} ${s.name}站 ${l.name} ${l.shortName} 站点 车站 ${area}`
      })
    })
  })
  pois.forEach((p) => {
    const cat = getCategory(p.category)
    const d = districts.find((it) => it.districtId === p.districtId)
    out.push({
      type: 'poi',
      id: p.poiId,
      name: p.name,
      aliases: [p.name],
      color: cat.color,
      sub: `${cat.name}${d ? ' · ' + d.name : ''}`,
      key: `${p.name} ${cat.name} 景点 ${d ? d.name : ''} ${(p.tags || []).join(' ')}`
    })
  })
  return out
}

const INDEX = buildIndex()

/**
 * 相关度打分：完全命中 > 前缀命中 > 名称内包含 > 仅正文命中。
 * 用别名而非仅 name 打分，是为了让「3号线」优先命中线路本身，
 * 而不是被同线的 8 个站点挤掉。
 * @param {object} it 索引项
 * @param {string} q 已 trim 的关键词
 * @returns {number} 越小越相关
 */
function scoreItem(it, q) {
  if (it.aliases.some((a) => a === q)) return 0
  if (it.aliases.some((a) => a.startsWith(q))) return 1
  if (it.aliases.some((a) => a.includes(q))) return 2
  return 3
}

/**
 * 中文子串匹配 + 轻量相关度排序（打分相同则名称更短的更相关）。
 * @param {string} raw 用户输入的关键词
 * @returns {Array<{it: object, s: number}>} 命中的结果（已截断到 MAX_RESULTS，按相关度升序）
 */
function query(raw) {
  const q = raw.trim()
  if (!q) return []
  const scored = []
  for (const it of INDEX) {
    const s = scoreItem(it, q)
    if (s < 3 || it.key.includes(q)) scored.push({ it, s })
  }
  scored.sort((a, b) => (a.s !== b.s ? a.s - b.s : a.it.name.length - b.it.name.length))
  return scored.slice(0, MAX_RESULTS)
}

/**
 * 全局搜索：分区 / 地铁线路 / 站点 / 景点。
 * - 桌面端：顶栏常驻输入框（≤720px 折叠成「搜索」按钮，展开后铺满顶栏）
 * - 键盘：↑/↓ 选择、Enter 确认、Esc 关闭；Ctrl/Cmd+K 或 / 唤起
 * - 选中后自动切到对应层并高亮该对象
 */
export default function SearchBox() {
  const [kw, setKw] = useState('')
  const [open, setOpen] = useState(false)
  // 手机端「铺满顶栏」的展开态；桌面端该状态只影响焦点，无视觉差异
  const [expanded, setExpanded] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  const scored = useMemo(() => query(kw), [kw])

  // 按类型分组；分组之间按「组内最高相关度」排序，
  // 否则搜「伪满皇宫」时，仅因简介里提到过就命中的分区会压过精确命中的站点。
  const groups = useMemo(() => {
    const gs = GROUPS.map((g) => ({
      ...g,
      items: scored.filter((x) => x.it.type === g.type)
    })).filter((g) => g.items.length > 0)
    gs.sort((a, b) => a.items[0].s - b.items[0].s)
    return gs
  }, [scored])

  // 展平后的顺序 == 视觉顺序，供 ↑/↓ 与 aria-activedescendant 使用
  const flat = useMemo(() => groups.flatMap((g) => g.items.map((x) => x.it)), [groups])

  const showPop = open && kw.trim().length > 0

  const closeAll = useCallback(() => {
    setKw('')
    setOpen(false)
    setExpanded(false)
    setActiveIdx(0)
    // 手机端收起时主动失焦，顺带收起软键盘
    if (inputRef.current) inputRef.current.blur()
  }, [])

  const focusSearch = useCallback(() => {
    setExpanded(true)
    setOpen(true)
    const el = inputRef.current
    if (el) {
      el.focus()
      if (typeof el.select === 'function') el.select()
    }
  }, [])

  // 点击 / 触摸空白处关闭下拉与手机端展开态
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [])

  // 手机端展开 / 快捷键唤起后自动聚焦
  useEffect(() => {
    if (expanded && inputRef.current) inputRef.current.focus()
  }, [expanded])

  // 全局快捷键：Ctrl/Cmd + K 或 / 唤起搜索
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const editing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        e.stopPropagation()
        focusSearch()
        return
      }
      if (e.key === '/' && !editing) {
        e.preventDefault()
        e.stopPropagation()
        focusSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusSearch])

  // 键盘高亮项滚动到可视区
  useEffect(() => {
    if (!showPop) return
    const el = boxRef.current && boxRef.current.querySelector('[data-active="true"]')
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, showPop])

  /** 选中结果：切到对应层 + 选中（3D 层会订阅 store 自动高亮） */
  const jump = (item) => {
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
    closeAll()
  }

  /**
   * 键盘处理挂在容器上：输入框与结果项都会冒泡到这里。
   * Esc 必须 stopPropagation，否则会冒泡到 App 的全局监听把详情抽屉一起关掉。
   */
  const onBoxKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeAll()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) =>
        e.key === 'ArrowDown' ? (i + 1) % flat.length : (i - 1 + flat.length) % flat.length
      )
      return
    }
    if (e.key === 'Enter') {
      const hit = flat[activeIdx]
      if (hit) {
        e.preventDefault()
        jump(hit)
      }
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn nav-search-btn"
        onClick={focusSearch}
        aria-label="打开搜索"
        aria-expanded={expanded}
      >
        搜索
      </button>
      <div className={'search-box' + (expanded ? ' is-open' : '')} ref={boxRef} onKeyDown={onBoxKeyDown}>
        <input
          ref={inputRef}
          type="text"
          value={kw}
          placeholder="搜索区域 / 线路 / 站点 / 景点"
          aria-label="全局搜索：区域、线路、站点、景点"
          role="combobox"
          aria-expanded={showPop}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={showPop && flat[activeIdx] ? optionId(activeIdx) : undefined}
          autoComplete="off"
          onChange={(e) => {
            setKw(e.target.value)
            setActiveIdx(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        <button type="button" className="search-cancel" onClick={closeAll}>
          取消
        </button>
        {showPop &&
          (flat.length > 0 ? (
            <div className="search-pop" id={LISTBOX_ID} role="listbox" aria-label="搜索结果">
              {groups.map((g) => (
                <div className="search-group" key={g.type} role="group" aria-label={g.label}>
                  <div className="search-group-title" aria-hidden="true">
                    {g.label}
                  </div>
                  {g.items.map((x) => {
                    const it = x.it
                    const idx = flat.indexOf(it)
                    return (
                      <button
                        key={it.type + it.id}
                        id={optionId(idx)}
                        type="button"
                        className={'search-item' + (idx === activeIdx ? ' hl' : '')}
                        role="option"
                        aria-selected={idx === activeIdx}
                        data-active={idx === activeIdx ? 'true' : undefined}
                        onClick={() => jump(it)}
                        onMouseEnter={() => setActiveIdx(idx)}
                      >
                        <i style={{ background: it.color }} />
                        <em className="search-badge">{g.label}</em>
                        <b>{it.name}</b>
                        <span>{it.sub}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="search-pop empty" id={LISTBOX_ID} role="status">
              未找到与「{kw.trim()}」相关的区域、线路、站点或景点
            </div>
          ))}
      </div>
    </>
  )
}
