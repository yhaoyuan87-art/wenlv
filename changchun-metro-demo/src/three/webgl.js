/**
 * WebGL 可用性检测。
 *
 * 3D 层（CityLayer / MetroLayer）在挂载前先调用 shouldFallback3D()：
 * 返回 true 时不去构造 Three.js 场景，直接渲染「3D 不可用」的降级卡片，
 * 避免不支持 WebGL 的设备上出现白屏（PRD 验收项）。
 */

/**
 * 读取 URL 参数 ?nowebgl=1。
 * 用途：演示 / 自测时强制进入降级态，无需真的找一台不支持 WebGL 的设备。
 * 该参数在 store 的 syncQuery() 里会被原样保留，方便翻页后仍是降级态。
 */
function readForceFlag() {
  try {
    const value = new URLSearchParams(window.location.search).get('nowebgl')
    return value === '1' || value === 'true'
  } catch {
    // SSR / 非浏览器环境直接视为不强制
    return false
  }
}

/**
 * 模块首次求值时就把开关取出来：
 * 之后 store 的 syncQuery() 会重写 URL，届时再读可能已经读不到该参数。
 */
const FORCE_NO_WEBGL = readForceFlag()

/**
 * 判断当前浏览器 / 设备是否可用 WebGL。
 * 做法：建一个临时 canvas，依次尝试 webgl2 → webgl → experimental-webgl，
 * 任一步拿到上下文即视为可用；成功后主动释放上下文，避免占用浏览器
 * 「同时存活的 WebGL 上下文数量」配额（通常 8~16 个）。
 * @returns {boolean} 可用返回 true
 */
export function isWebGLAvailable() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const attrs = { failIfMajorPerformanceCaveat: false }
    const gl =
      canvas.getContext('webgl2', attrs) ||
      canvas.getContext('webgl', attrs) ||
      canvas.getContext('experimental-webgl', attrs)
    if (!gl) return false
    // 用完立刻归还：某些浏览器对同时存在的上下文数量有限制
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
    return true
  } catch {
    // 部分环境下 getContext 会直接抛异常（如禁用 GPU / 隐私模式）
    return false
  }
}

/**
 * 3D 层是否应该直接渲染降级 UI。
 * 命中 ?nowebgl=1 或 WebGL 不可用时返回 true。
 * @returns {boolean}
 */
export function shouldFallback3D() {
  return FORCE_NO_WEBGL || !isWebGLAvailable()
}

/** 供调试使用：当前是否由 URL 参数强制降级 */
export function isForcedNoWebGL() {
  return FORCE_NO_WEBGL
}
