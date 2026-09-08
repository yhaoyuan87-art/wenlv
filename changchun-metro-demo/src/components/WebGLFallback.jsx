import { useStore } from '../store/useStore.js'

/**
 * WebGL 不可用时的 3D 层兜底 UI。
 * 说明原因，并引导用户切到 2D 总览层（map2d 本身就是完整的 2D 版本），
 * 保证「不支持 3D 也能继续用」，而不是白屏。
 *
 * @param {{ layer?: 'city' | 'metro' }} props 当前所在的 3D 层，用于文案区分
 */
export default function WebGLFallback({ layer = 'city' }) {
  const goLayer = useStore((s) => s.goLayer)
  const title = layer === 'metro' ? '地铁空间 3D' : '城市 3D'

  return (
    <div className="webgl-fallback">
      <div className="fallback-card" role="status">
        <span className="fallback-icon" aria-hidden="true">
          🧭
        </span>
        <h3>{title} 视图不可用</h3>
        <p className="muted">
          当前浏览器 / 设备不支持 WebGL，无法渲染 3D 场景。你可以切换到 2D 总览，
          同样能查看分区、线路、站点与景点的联动关系。
        </p>
        <div className="fallback-actions">
          <button type="button" className="btn primary" onClick={() => goLayer('map2d')}>
            切换到 2D 总览
          </button>
        </div>
        <p className="fallback-tip">也可以改用最新版 Chrome / Edge / Safari，或在浏览器设置中开启「硬件加速」后重试。</p>
      </div>
    </div>
  )
}
