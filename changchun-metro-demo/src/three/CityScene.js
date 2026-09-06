import * as THREE from 'three'
import CameraControls from 'camera-controls'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { districts, landmarks, yitongRiver } from '../data/districts.js'
import { pixelRatio, fitCamera, portraitPull, observeSize, isMobile } from './adapt.js'
import { cssVar, hexToNumber } from '../theme/theme.js'

CameraControls.install({ THREE })

export function toXZ(x, y) {
  return { X: x - 500, Z: y - 380 }
}

function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export class CityScene {
  constructor(container, callbacks) {
    this.container = container
    this.callbacks = callbacks
    this.disposed = false
    this.selectedId = null
    this.hoverId = null
    this.reduceMotion = false
    this.clock = new THREE.Clock()
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2(-10, -10)
    this.downPos = null
    this.districtMeshes = []
    this.districtGroups = {}
    this.labelPool = []

    this._onPointerDown = this.onPointerDown.bind(this)
    this._onPointerMove = this.onPointerMove.bind(this)
    this._onPointerLeave = this.onPointerLeave.bind(this)
    this._onPointerUp = this.onPointerUp.bind(this)
    this._onClick = this.onClick.bind(this)
    this._onResize = this.onResize.bind(this)
    this._onUserInput = () => { this.userMoved = true }

    // 竖屏补偿系数 / 用户是否手动动过镜头 / 最近一次程序化机位
    this.pull = 1
    this.userMoved = false
    this.lastView = null
    this.tapHit = null
    this.landmarkHitMeshes = []
    // 详情面板遮挡的安全区（px）与当前平滑插值值
    this.safeRight = 0
    this.safeBottom = 0
    this._offX = 0
    this._offY = 0

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this._sceneBg())
    this.scene.fog = new THREE.Fog(this._sceneBg(), 900, 1800)

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 4000)
    this.camera.position.set(0, 560, 640)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(pixelRatio())
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight)
    this.labelRenderer.domElement.style.position = 'absolute'
    this.labelRenderer.domElement.style.top = '0'
    this.labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.labelRenderer.domElement)

    this.controls = new CameraControls(this.camera, this.renderer.domElement)
    this.controls.maxPolarAngle = Math.PI / 2.15
    this.controls.minDistance = 120
    this.controls.maxDistance = 1400
    this.controls.smoothTime = 0.7
    this.controls.draggingSmoothTime = 0.15
    // 触摸：单指旋转 / 双指缩放由 camera-controls 处理，这里放宽惯性便于小屏操作
    this.controls.dollyToCursor = false
    this.controls.addEventListener('controlstart', this._onUserInput)

    this.hemiLight = new THREE.HemisphereLight(0x8fb5ff, 0x1a2340, 0.9)
    this.scene.add(this.hemiLight)
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(300, 500, 200)
    this.scene.add(dir)

    this.buildGround()
    this.buildRiver()
    this.buildDistricts()
    this.buildBuildings()
    this.buildLandmarks()

    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.addEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.addEventListener('click', this._onClick)
    this._stopObserving = observeSize(container, this._onResize)

    // 首次构图：按当前容器宽高比决定 fov 与竖屏拉远系数
    this.applyViewport()
    this.resetView()

    this.animate = this.animate.bind(this)
    this.animate()
  }

  /** 同步容器宽高比 → 相机 fov / 竖屏拉远系数 / 标签尺寸档位 */
  applyViewport() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const aspect = w / Math.max(h, 1)
    fitCamera(this.camera, aspect)
    this.pull = portraitPull(aspect)
    this.compact = isMobile()
  }

  buildGround() {
    const g = new THREE.PlaneGeometry(2200, 1800)
    const m = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 1 })
    const mesh = new THREE.Mesh(g, m)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -1
    this.scene.add(mesh)
    this.groundMat = m

    const grid = new THREE.GridHelper(2200, 44, 0x22314f, 0x182238)
    this.gridHelper = grid
    grid.position.y = 0.5
    this.scene.add(grid)
  }

  buildRiver() {
    const pts = yitongRiver.map(([x, y]) => {
      const { X, Z } = toXZ(x, y)
      return new THREE.Vector3(X, 0, Z)
    })
    const curve = new THREE.CatmullRomCurve3(pts)
    const samples = curve.getPoints(90)
    const positions = []
    const halfW = 5
    for (let i = 0; i < samples.length - 1; i++) {
      const p = samples[i]
      const q = samples[i + 1]
      const dx = q.x - p.x
      const dz = q.z - p.z
      const len = Math.hypot(dx, dz) || 1
      const nx = (-dz / len) * halfW
      const nz = (dx / len) * halfW
      const y = 1.2
      positions.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz, q.x + nx, y, q.z + nz)
      positions.push(p.x - nx, y, p.z - nz, q.x - nx, y, q.z - nz, q.x + nx, y, q.z + nz)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3a95c9,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'yitong-river'
    this.scene.add(mesh)
  }

  districtShape(poly) {
    const shape = new THREE.Shape()
    poly.forEach(([x, y], i) => {
      const { X, Z } = toXZ(x, y)
      if (i === 0) shape.moveTo(X, Z)
      else shape.lineTo(X, Z)
    })
    return shape
  }

  buildDistricts() {
    for (const d of districts) {
      const group = new THREE.Group()
      const shape = this.districtShape(d.polygon)
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d.height, bevelEnabled: false })
      geo.rotateX(Math.PI / 2)
      const color = new THREE.Color(d.color)
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.12),
        roughness: 0.65,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData = { type: 'district', id: d.districtId }
      group.add(mesh)
      this.districtMeshes.push(mesh)

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35 })
      )
      group.add(edge)

      const labelDiv = document.createElement('div')
      labelDiv.className = 'city-label'
      labelDiv.textContent = d.name
      labelDiv.addEventListener('click', () => this.callbacks.onSelectDistrict(d.districtId))
      const { X, Z } = toXZ(d.label[0], d.label[1])
      const labelObj = new CSS2DObject(labelDiv)
      labelObj.position.set(X, d.height + 14, Z)
      group.add(labelObj)
      this.labelPool.push(labelDiv)

      this.scene.add(group)
      this.districtGroups[d.districtId] = { group, mat, edge }
    }
  }

  buildBuildings() {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0x35507e, roughness: 0.9, transparent: true, opacity: 0.85 })
    const positions = []
    const rand = mulberry32(20260904)
    for (const d of districts) {
      const xs = d.polygon.map((p) => p[0])
      const ys = d.polygon.map((p) => p[1])
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      let count = 0
      let guard = 0
      const target = 70
      while (count < target && guard < 600) {
        guard++
        const px = minX + rand() * (maxX - minX)
        const py = minY + rand() * (maxY - minY)
        if (!pointInPolygon(px, py, d.polygon)) continue
        const lx = px - d.label[0]
        const ly = py - d.label[1]
        if (Math.abs(lx) < 26 && Math.abs(ly) < 26) continue
        const { X: wx, Z: wz } = toXZ(px, py)
        positions.push({ x: wx, z: wz, h: 4 + rand() * 14, s: 4 + rand() * 6 })
        count++
      }
    }
    const inst = new THREE.InstancedMesh(box, mat, positions.length)
    const dummy = new THREE.Object3D()
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.h / 2, p.z)
      dummy.scale.set(p.s, p.h, p.s)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.name = 'buildings'
    this.scene.add(inst)
    this.buildingsMesh = inst
  }

  buildLandmarks() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38e1ff,
      emissive: 0x1a9cc4,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      opacity: 0.95
    })
    for (const lm of landmarks) {
      const { X, Z } = toXZ(lm.x, lm.y)
      const geo = new THREE.CylinderGeometry(4.5, 6, lm.h, 6)
      const mesh = new THREE.Mesh(geo, mat.clone())
      mesh.position.set(X, lm.h / 2, Z)
      mesh.userData = { type: 'landmark', name: lm.name, districtId: lm.districtId, baseY: lm.h / 2, phase: (landmarks.indexOf(lm) * Math.PI * 2) / landmarks.length }
      this.scene.add(mesh)
      this.landmarkMeshes = this.landmarkMeshes || []
      this.landmarkMeshes.push(mesh)

      // 触摸热区：地标柱体只有几像素宽，手指点不中；
      // 叠一个不可见的大判定球（material.visible=false → 不渲染，但仍可被 raycast 命中）
      const hitR = Math.max(13, Math.min(lm.h / 2 + 6, 24))
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(hitR, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      )
      hit.position.set(X, lm.h / 2, Z)
      hit.userData = { type: 'landmark', name: lm.name, districtId: lm.districtId }
      this.scene.add(hit)
      this.landmarkHitMeshes.push(hit)

      const labelDiv = document.createElement('div')
      labelDiv.className = 'landmark-label'
      labelDiv.textContent = lm.name
      const labelObj = new CSS2DObject(labelDiv)
      labelObj.position.set(X, lm.h + 8, Z)
      this.scene.add(labelObj)
    }
  }

  onPointerDown(e) {
    this.downPos = { x: e.clientX, y: e.clientY }
    this.updatePointerFromEvent(e)
    // 触屏没有 hover，pointermove 不会在点击前触发；
    // 必须在 down 阶段就把命中结果算好，否则 click 时 raycast 用的还是旧坐标
    this.tapHit = this.pick()
  }

  onPointerUp(e) {
    // 触摸结束后清掉 hover 高亮，避免手指离开后仍残留发光
    if (e.pointerType && e.pointerType !== 'mouse') this.clearHoverVisual()
  }

  onPointerLeave() {
    this.pointer.set(-10, -10)
    this.updateHover()
  }

  updatePointerFromEvent(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  onPointerMove(e) {
    this.updatePointerFromEvent(e)
    this.updateHover()
  }

  isDrag(e) {
    if (!this.downPos) return false
    return Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > (isMobile() ? 10 : 5)
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const targets = [...this.districtMeshes, ...this.landmarkHitMeshes]
    const hits = this.raycaster.intersectObjects(targets, false)
    return hits.length ? hits[0].object : null
  }

  /** 只清视觉高亮，不动 pointer（点击命中结果已存在 tapHit 里） */
  clearHoverVisual() {
    this.hoverId = null
    for (const d of districts) {
      const entry = this.districtGroups[d.districtId]
      if (!entry || d.districtId === this.selectedId) continue
      entry.mat.emissive.copy(new THREE.Color(d.color)).multiplyScalar(0.12)
    }
    this.labelPool.forEach((el, i) => {
      el.classList.toggle('active', !!districts[i] && districts[i].districtId === this.selectedId)
    })
  }

  updateHover() {
    const hover = this.pick()
    const id = hover && hover.userData.type === 'district' ? hover.userData.id : null
    if (id !== this.hoverId) {
      this.hoverId = id
      this.renderer.domElement.style.cursor = id || hover ? 'pointer' : 'grab'
      for (const d of districts) {
        const entry = this.districtGroups[d.districtId]
        if (!entry) continue
        if (d.districtId === this.selectedId) continue
        const isHover = d.districtId === id
        entry.mat.emissive.copy(new THREE.Color(d.color)).multiplyScalar(isHover ? 0.5 : 0.12)
      }
      this.labelPool.forEach((el, i) => {
        el.classList.toggle('active', districts[i] && districts[i].districtId === (id || this.selectedId))
      })
    }
  }

  onClick(e) {
    if (this.isDrag(e)) {
      this.tapHit = null
      return
    }
    // 优先用 pointerdown 阶段算好的命中结果（触屏必须），鼠标退化为实时拾取
    const hit = this.tapHit || this.pick()
    this.tapHit = null
    if (!hit) {
      this.setSelected(null)
      this.callbacks.onSelectDistrict(null)
      return
    }
    if (hit.userData.type === 'district') {
      this.setSelected(hit.userData.id)
      this.callbacks.onSelectDistrict(hit.userData.id)
    } else if (hit.userData.type === 'landmark') {
      this.callbacks.onSelectLandmark(hit.userData)
    }
  }

  setSelected(id) {
    this.selectedId = id
    for (const d of districts) {
      const entry = this.districtGroups[d.districtId]
      if (!entry) continue
      const selected = d.districtId === id
      const dim = id && !selected
      entry.mat.opacity = dim ? 0.28 : 0.95
      const baseColor = new THREE.Color(d.color)
      if (selected) {
        entry.mat.emissive.set(0x2ba8d8)
        entry.mat.emissiveIntensity = 0.55
      } else {
        entry.mat.emissive.copy(baseColor).multiplyScalar(0.12)
        entry.mat.emissiveIntensity = 1
      }
      entry.edge.material.opacity = selected ? 0.9 : 0.35
      entry.group.position.y = 0
    }
    if (id) this.focusDistrict(id)
  }

  focusDistrict(id) {
    const d = districts.find((x) => x.districtId === id)
    if (!d) return
    const { X, Z } = toXZ(d.label[0], d.label[1])
    this.flyTo(new THREE.Vector3(X, 300, Z + 260), new THREE.Vector3(X, 0, Z))
  }

  resetView() {
    this.flyTo(new THREE.Vector3(0, 560, 640), new THREE.Vector3(0, 0, 0), !this.lastView)
  }

  topView() {
    this.flyTo(new THREE.Vector3(0, 1000, 4), new THREE.Vector3(0, 0, 0), true)
  }

  /**
   * @param pos 目标机位（以 16:9 为基准调好的构图）
   * @param look 注视点
   * @param animate 是否补间；false 用于首帧定位与旋转屏后的重新构图
   */
  flyTo(pos, look, animate = true) {
    this.lastView = { pos: pos.clone(), look: look.clone() }
    const p = new THREE.Vector3(
      look.x + (pos.x - look.x) * this.pull,
      look.y + (pos.y - look.y) * this.pull,
      look.z + (pos.z - look.z) * this.pull
    )
    this.controls.setLookAt(p.x, p.y, p.z, look.x, look.y, look.z, animate && !this.reduceMotion)
  }

  /** 从 CSS 变量读取场景背景色，供主题联动 */
  _sceneBg() {
    const hex = cssVar('--scene-bg')
    return hexToNumber(hex, 0x0a0f1c)
  }

  /** 主题切换：同步场景背景、雾、地面、网格与灯光反射色 */
  setTheme() {
    const bg = this._sceneBg()
    if (this.scene.background) this.scene.background.set(bg)
    if (this.scene.fog) this.scene.fog.color.set(bg)
    // 地面 / 网格 / 半球光反射：深色地面在浅色主题下会与背景严重割裂，需一并切换
    if (this.groundMat) this.groundMat.color.set(hexToNumber(cssVar('--scene-ground'), 0x101828))
    if (this.gridHelper) {
      this.gridHelper.material.color.set(hexToNumber(cssVar('--scene-grid'), 0x22314f))
    }
    if (this.hemiLight) {
      this.hemiLight.groundColor.set(hexToNumber(cssVar('--scene-bounce'), 0x1a2340))
    }
  }

  /** 详情面板遮挡补偿：上报被面板挡住的右/下边缘宽度（px），取景中心会平滑滑向未遮挡区域 */
  setPanelInsets(insets) {
    this.safeRight = Math.max(0, insets?.right || 0)
    this.safeBottom = Math.max(0, insets?.bottom || 0)
  }

  /**
   * 每帧把视野中心朝目标偏移做插值（setViewOffset 的 offsetX/Y 与遮挡宽度成正比）：
   * 正 offsetX → 内容在屏幕上左移（右侧面板遮挡时），正 offsetY → 内容上移（底部抽屉遮挡时）。
   * 用视锥平移而不是移动相机，用户手动环绕/缩放的手感完全不受影响。
   */
  _updateViewOffset(delta) {
    const targetX = this.safeRight / 2
    const targetY = this.safeBottom / 2
    const k = Math.min(1, delta * 6)
    this._offX += (targetX - this._offX) * k
    this._offY += (targetY - this._offY) * k
    if (Math.abs(this._offX) < 0.5 && Math.abs(this._offY) < 0.5) {
      this._offX = 0
      this._offY = 0
      if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset()
      return
    }
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.setViewOffset(w, h, this._offX, this._offY, w, h)
  }

  setReduceMotion(v) {
    this.reduceMotion = v
    this.controls.smoothTime = v ? 0.0001 : 0.7
    this.controls.draggingSmoothTime = v ? 0.0001 : 0.15
  }

  onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)

    const prevPull = this.pull
    this.applyViewport()

    // 旋转屏 / 断点切换导致取景系数变化时，若用户还没手动动过镜头就重新构图
    if (this.lastView && !this.userMoved && Math.abs(prevPull - this.pull) > 0.001) {
      const { pos, look } = this.lastView
      this.flyTo(pos, look, false)
    }
  }

  animate() {
    if (this.disposed) return
    requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()
    this.controls.update(delta)
    this._updateViewOffset(delta)
    if (!this.reduceMotion && this.landmarkMeshes) {
      const t = performance.now() / 1000
      for (const m of this.landmarkMeshes) {
        m.position.y = m.userData.baseY + Math.sin(t * 1.2 + m.userData.phase) * 2.4
      }
    }
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.controls.removeEventListener('controlstart', this._onUserInput)
    this.controls.dispose()
    if (this._stopObserving) this._stopObserving()
    this.renderer.dispose()
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.removeEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.removeEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.removeEventListener('click', this._onClick)
    window.removeEventListener('resize', this._onResize)
  }
}
