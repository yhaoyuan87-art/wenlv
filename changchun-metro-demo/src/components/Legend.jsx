import { useStore } from '../store/useStore.js'
import { metroLines } from '../data/metroLines.js'
import { poiCategories } from '../data/pois.js'
import { themes } from '../data/themes.js'

export default function Legend() {
  const open = useStore((s) => s.legendOpen)
  const toggleLegend = useStore((s) => s.toggleLegend)

  if (!open) return null

  return (
    <>
      <div className="legend-mask" onClick={toggleLegend} />
      <div className="legend-panel" role="dialog" aria-label="图例与帮助">
        <div className="legend-head">
          <h3>图例与帮助</h3>
          <button onClick={toggleLegend} aria-label="关闭图例">×</button>
        </div>
        <h4>地铁线路</h4>
        <div className="legend-rows">
          {metroLines.map((l) => (
            <div key={l.lineId} className="legend-row">
              <i style={{ background: l.color }} />
              <b>{l.name}</b>
              <span>{l.direction}</span>
            </div>
          ))}
        </div>
        <h4>景点类别</h4>
        <div className="legend-rows">
          {poiCategories.map((c) => (
            <div key={c.id} className="legend-row">
              <i style={{ background: c.color }} />
              <b>{c.name}</b>
            </div>
          ))}
        </div>
        <h4>主题路线</h4>
        <div className="legend-rows">
          {themes.map((t) => (
            <div key={t.themeId} className="legend-row">
              <i style={{ background: t.color }} />
              <b>{t.name}</b>
              <span>{t.route}</span>
            </div>
          ))}
        </div>
        <h4>旅行贴士</h4>
        <ul className="legend-help">
          <li>最佳季节：5-10 月避暑纳凉，12-2 月冰雪节与滑雪季</li>
          <li>特产手礼：鼎丰真糕点、粘豆包、木耳、东北山货</li>
          <li>机场交通：龙嘉国际机场距市区约 30 公里，城际高铁直达龙嘉站</li>
          <li>美食街区：桂林路（夜市烧烤）、红旗街（老字号商圈）</li>
          <li>特色体验：净月潭划船、长影拍照场景、长春国际冰雪节（冬季）</li>
        </ul>
        <h4>操作说明</h4>
        <ul className="legend-help">
          <li>快捷键：数字键 1-4 切换四层，Esc 关闭详情/图例</li>
          <li>城市 3D 层：拖拽旋转、滚轮缩放、点击分区聚焦，左下角可切换全景/俯视</li>
          <li>地铁层：白色节点为换乘站，线路悬浮表示地下空间，可切换俯视查看线网</li>
          <li>四层共享同一份数据，切层后当前对象保持高亮</li>
          <li>顶部搜索可直达任意区域、线路、站点或景点</li>
          <li>路线模式下地图将画出打卡动线，按序号顺序游览</li>
        </ul>
      </div>
    </>
  )
}
