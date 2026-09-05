import * as THREE from 'three'

/**
 * 3D 层在移动端 / 竖屏下的通用适配逻辑。
 * 断点与 index.css 的 @media (max-width: 720px) 保持一致。
 */

const MQ = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 720px)') : null

export function isMobile() {
  return MQ ? MQ.matches : false
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0
}

/** 移动端把像素比压到 1.5，避免 3x 屏手机渲染压力过大导致掉帧 */
export function pixelRatio() {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  return Math.min(dpr, isMobile() ? 1.5 : 2)
}

export const BASE_FOV = 50
export const BASE_ASPECT = 16 / 9
const MAX_FOV = 92

/**
 * 竖屏构图：以 16:9 为基准锁定「水平视野」。
 * PerspectiveCamera.fov 是垂直视野，aspect 变小时水平内容会被裁掉；
 * 这里反推出保持水平视野不变所需的垂直 fov（并设上限，防止极端畸变）。
 */
export function fitCamera(camera, aspect, baseFov = BASE_FOV) {
  if (!aspect || !Number.isFinite(aspect)) return
  if (aspect >= BASE_ASPECT) {
    camera.fov = baseFov
  } else {
    const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * BASE_ASPECT)
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect)
    camera.fov = Math.min(THREE.MathUtils.radToDeg(vFov), MAX_FOV)
  }
  camera.aspect = aspect
  camera.updateProjectionMatrix()
}

/**
 * fov 被 MAX_FOV 截断后损失的那部分视野，改用「把镜头拉远」补偿，
 * 保证竖屏下横向可见范围与桌面一致。返回距离系数。
 */
export function portraitPull(aspect, baseFov = BASE_FOV) {
  if (!aspect || !Number.isFinite(aspect) || aspect >= BASE_ASPECT) return 1
  const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * BASE_ASPECT)
  const wanted = 2 * Math.atan(Math.tan(hFov / 2) / aspect)
  const capped = Math.min(wanted, THREE.MathUtils.degToRad(MAX_FOV))
  return Math.tan(wanted / 2) / Math.tan(capped / 2)
}

/**
 * 监听容器尺寸变化。
 * ResizeObserver 比 window.resize 可靠：能覆盖旋转屏、地址栏收放、
 * 以及底部导航出现导致的舞台高度变化。
 */
export function observeSize(el, cb) {
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', cb)
    window.addEventListener('orientationchange', cb)
    return () => {
      window.removeEventListener('resize', cb)
      window.removeEventListener('orientationchange', cb)
    }
  }
  const ro = new ResizeObserver(() => cb())
  ro.observe(el)
  return () => ro.disconnect()
}
