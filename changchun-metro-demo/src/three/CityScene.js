import * as THREE from 'three'
import CameraControls from 'camera-controls'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { districts, landmarks, yitongRiver } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { pixelRatio, fitCamera, portraitPull, observeSize, isMobile } from './adapt.js'
import { cssVar, hexToNumber } from '../theme/theme.js'

CameraControls.install({ THREE })

export function toXZ(x, y) {
  return { X: x - 500, Z: y - 380 }
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

    this.modelRoot = null
    this.modelReady = false
    this.modelScale = 1
    this.districtLabelObjs = []
    this.stationLabelObjs = []
    this.cityLabelCands = []
    this.composer = null
    this.bloomPass = null

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
    this.buildSupplements()
    this.loadModel()
    this._initBloom()

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
  }

  /**
   * Blender 模型缺项的数据侧补齐：
   * ① 九台区（模型按旧六区建模，无此区）→ 用 districts.json 多边形补轮廓面/边界/标签；
   * ② 伊通河带（模型里没有）；
   * ③ 龙嘉机场地标（模型范围外）。同伴重新导出模型后可按需删除。
   */
  buildSupplements() {
    // ① 九台区
    const jd = districts.find((x) => x.districtId === 'district-jiutai')
    if (jd && !this.districtGroups[jd.districtId]) {
      const shape = new THREE.Shape()
      jd.polygon.forEach(([x, y], i) => {
        const { X, Z } = toXZ(x, y)
        if (i === 0) shape.moveTo(X, Z)
        else shape.lineTo(X, Z)
      })
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false })
      geo.rotateX(Math.PI / 2)
      const color = new THREE.Color(jd.color)
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.12),
        roughness: 0.65,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData = { type: 'district', id: jd.districtId }
      this.districtMeshes.push(mesh)
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35 })
      )
      edge.position.y = 0.2
      const group = new THREE.Group()
      group.add(mesh)
      group.add(edge)
      this.scene.add(group)
      this.districtGroups[jd.districtId] = { group, mat, edge }

      const div = document.createElement('div')
      div.className = 'city3d-label city3d-district'
      div.textContent = jd.name
      div.addEventListener('click', () => this.callbacks.onSelectDistrict(jd.districtId))
      const { X, Z } = toXZ(jd.label[0], jd.label[1])
      const lobj = new CSS2DObject(div)
      lobj.position.set(X, 10, Z)
      this.scene.add(lobj)
      this.districtLabelObjs.push(lobj)
    }

    // ② 伊通河带（数据驱动，半透明蓝色）
    const pts = yitongRiver.map(([x, y]) => {
      const { X, Z } = toXZ(x, y)
      return new THREE.Vector3(X, 0, Z)
    })
    if (pts.length > 1) {
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
        positions.push(p.x - nx, y, p.z - nz, q.x - nx, y, p.z - nz, q.x + nx, y, q.z + nz)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      const mat = new THREE.MeshBasicMaterial({
        color: 0x3a95c9,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const mesh = new THREE.Mesh(geo, mat)
      this.scene.add(mesh)
    }

    // ③ 模型范围外的地标（龙嘉机场）：柱体 + 点击热区 + 可点标签
    for (const lm of landmarks) {
      if (lm.districtId !== 'district-jiutai') continue
      const { X, Z } = toXZ(lm.x, lm.y)
      const geo = new THREE.CylinderGeometry(4.5, 6, lm.h, 6)
      const mat = new THREE.MeshStandardMaterial({
        color: 0x38e1ff,
        emissive: 0x1a9cc4,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: 0.95
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(X, lm.h / 2, Z)
      mesh.userData = { type: 'station', name: lm.name, districtId: lm.districtId, baseY: lm.h / 2, phase: Math.random() * Math.PI * 2 }
      this.scene.add(mesh)
      this.landmarkMeshes = this.landmarkMeshes || []
      this.landmarkMeshes.push(mesh)
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(14, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      )
      hit.position.set(X, lm.h / 2, Z)
      hit.userData = { type: 'station', name: lm.name, districtId: lm.districtId }
      this.scene.add(hit)
      this.landmarkHitMeshes.push(hit)
      const div = document.createElement('div')
      div.className = 'landmark-label'
      div.textContent = lm.name
      div.addEventListener('click', () => this.callbacks.onSelectLandmark({ type: 'station', name: lm.name, districtId: lm.districtId }))
      const lobj = new CSS2DObject(div)
      lobj.position.set(X, lm.h + 8, Z)
      this.scene.add(lobj)
    }
  }

  /** Bloom 后处理：桌面端启用，夜景让模型灯光/线路呈辉光（参数随主题自适应） */
  _initBloom() {
    if (isMobile()) return
    try {
      const w = this.container.clientWidth || 1
      const h = this.container.clientHeight || 1
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.4, 0.62)
      this.composer.addPass(this.bloomPass)
      this.composer.addPass(new OutputPass())
      this.setTheme()
    } catch (err) {
      console.warn('[CityScene] Bloom 初始化失败，使用直渲', err)
      this.composer = null
      this.bloomPass = null
    }
  }

  /**
   * 全量站点补齐：Blender 模型只建了 15 个换乘站的网格，
   * 其余站点用 InstancedMesh 小柱体补齐（含命中拾取），
   * 标签进避让队列——换乘站常显，普通站在选中所属区后显示。
   */
  buildStationPins() {
    const known = new Set(this.landmarkHitMeshes.map((m) => m.userData.name).filter(Boolean))
    const pinGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.6, 8)
    const list = []
    for (const line of metroLines) {
      for (const st of line.stations) {
        if (known.has(st.name)) continue
        if (list.some((x) => x.name === st.name)) continue // 同名跨线站物理同一座，去重
        const { X, Z } = toXZ(st.x, st.y)
        let districtId = null
        for (const d of districts) {
          if (pointInPolygon(st.x, st.y, d.polygon)) {
            districtId = d.districtId
            break
          }
        }
        list.push({ name: st.name, x: X, z: Z, districtId, transfer: (st.transfer || []).length > 0 })
      }
    }
    if (!list.length) return
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe9f7,
      emissive: 0x2b4a78,
      emissiveIntensity: 0.9,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95
    })
    const inst = new THREE.InstancedMesh(pinGeo, mat, list.length)
    const dummy = new THREE.Object3D()
    list.forEach((p, i) => {
      dummy.position.set(p.x, 1.3, p.z)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.userData = { type: 'stationPin' }
    this.scene.add(inst)
    this.stationPins = { inst, list }
    for (const p of list) {
      const div = document.createElement('div')
      div.className = 'city3d-label city3d-station'
      div.textContent = p.name
      const lobj = new CSS2DObject(div)
      lobj.position.set(p.x, 4.6, p.z)
      this.scene.add(lobj)
      this.cityLabelCands.push({
        obj: lobj,
        name: p.name,
        districtId: p.districtId,
        transfer: p.transfer,
        prio: p.transfer ? 2 : 1,
        w: p.name.length * 13 + 18,
        h: 22
      })
      div.addEventListener('click', () => {
        this.callbacks.onSelectLandmark({ type: 'station', name: p.name, districtId: p.districtId })
      })
    }
  }

  loadModel() {
    const loader = new GLTFLoader()
    loader.load(
      '/models/changchun-city.glb',
      (gltf) => {
        if (this.disposed) return
        const model = gltf.scene
        this.modelRoot = model
        this.fitModel(model)
        this.scene.add(model)
        this.wireModelInteractions(model)
        this.buildStationPins()
        this.modelReady = true
        if (this.callbacks.onModelReady) this.callbacks.onModelReady()
        if (!this.userMoved) this.resetView()
      },
      undefined,
      (err) => {
        console.error('[CityScene] model load failed', err)
      }
    )
  }

  fitModel(model) {
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const targetWidth = 1280
    const s = targetWidth / Math.max(size.x, size.z)
    this.modelScale = s
    model.scale.setScalar(s)
    model.position.set(-center.x * s, -box.min.y * s, -center.z * s)
  }

  wireModelInteractions(model) {
    const nameToId = {}
    for (const d of districts) {
      nameToId[d.name] = d.districtId
      if (d.name.endsWith('区')) nameToId[d.name.slice(0, -1)] = d.districtId
    }

    const stationMeshes = []
    const nameDistrict = {}
    const ray = new THREE.Raycaster()
    const tmpWP = new THREE.Vector3()
    const tmpBox = new THREE.Box3()

    // 先把模型里所有文字相关的 Mesh 隐藏，字体未导出导致方块。
    // 之后再用 CSS2D 标签覆盖显示真实中文。
    model.traverse((obj) => {
      if (!obj.isMesh) return
      const n = obj.name || ''
      if (
        n.endsWith('_行政区标签') ||
        n.endsWith('_行政区标签_投影') ||
        n.endsWith('_站名') ||
        n.endsWith('_站名_投影')
      ) {
        obj.visible = false
      }
    })

    model.updateMatrixWorld(true)

    model.traverse((obj) => {
      if (!obj.isMesh) return
      const n = obj.name || ''

      const plateMatch = n.match(/^(.+?)_参考图轮廓面(?:Mesh)?$/)
      if (plateMatch) {
        const dName = plateMatch[1]
        const districtId = nameToId[dName]
        if (districtId) {
          // GLB 导出时所有轮廓面共享同一材质实例：不 clone 的话 dim/hover
          // 改一个区会把全部区一起染色（遍历 districts 时互相覆盖）
          const mat = obj.material && !Array.isArray(obj.material) ? obj.material.clone() : new THREE.MeshStandardMaterial()
          mat.transparent = true
          mat.side = THREE.DoubleSide
          const d = districts.find((x) => x.districtId === districtId)
          if (d) mat.color.set(new THREE.Color(d.color))
          obj.material = mat
          obj.userData = { type: 'district', id: districtId }
          this.districtMeshes.push(obj)
          this.districtGroups[districtId] = { group: null, mat, edge: null }
        }
      }

      const edgeMatch = n.match(/^(.+?)_分区边界(?:Curve|Mesh)?$/)
      if (edgeMatch) {
        const dName = edgeMatch[1]
        const districtId = nameToId[dName]
        if (districtId) {
          const entry = this.districtGroups[districtId]
          if (entry) {
            entry.edge = obj
            const mat = obj.material
            if (mat && !Array.isArray(mat)) mat.transparent = true
          }
        }
      }

      const stationMatch = n.match(/^(.+?)_站点(?:外圈)?(?:Mesh)?$/)
      if (stationMatch && !n.includes('投影')) {
        const sName = stationMatch[1]
        obj.userData = { type: 'station', name: sName }
        stationMeshes.push(obj)
      }

      // 区名标签：用 CSS2D 覆盖，避免 Blender 字体烘焙失败导致的方块
      const distLabelMatch = n.match(/^(.+?)_行政区标签$/)
      if (distLabelMatch) {
        const dName = distLabelMatch[1]
        const districtId = nameToId[dName]
        obj.getWorldPosition(tmpWP)
        tmpBox.setFromObject(obj)
        const center = tmpBox.getCenter(new THREE.Vector3())
        const div = document.createElement('div')
        div.className = 'city3d-label city3d-district'
        div.textContent = dName
        if (districtId) {
          div.addEventListener('click', () => this.callbacks.onSelectDistrict(districtId))
        }
        const lobj = new CSS2DObject(div)
        lobj.position.copy(center)
        lobj.userData = { districtId }
        this.scene.add(lobj)
        this.districtLabelObjs.push(lobj)
      }

      // 站名标签
      const stLabelMatch = n.match(/^(.+?)_站名$/)
      if (stLabelMatch) {
        const sName = stLabelMatch[1]
        tmpBox.setFromObject(obj)
        const center = tmpBox.getCenter(new THREE.Vector3())
        const div = document.createElement('div')
        div.className = 'city3d-label city3d-station'
        div.textContent = sName
        const lobj = new CSS2DObject(div)
        lobj.position.copy(center)
        this.scene.add(lobj)
        this.stationLabelObjs.push(lobj)
      }
    })

    for (const sm of stationMeshes) {
      const wp = new THREE.Vector3()
      sm.getWorldPosition(wp)
      ray.set(new THREE.Vector3(wp.x, 1000, wp.z), new THREE.Vector3(0, -1, 0))
      const hits = ray.intersectObjects(this.districtMeshes, false)
      if (hits.length) sm.userData.districtId = hits[0].object.userData.id
      this.landmarkHitMeshes.push(sm)
      nameDistrict[sm.userData.name] = sm.userData.districtId || null
      if (window.__dbgDistrict !== undefined) window.__dbgDistrict[sm.userData.name] = sm.userData.districtId
    }

    // 站名标签避让：记录候选（换乘判定 + 区归属 + 宽高），每帧由 cullCityLabels 调度
    for (const lobj of this.stationLabelObjs) {
      const name = lobj.element.textContent
      const linesWithName = metroLines.filter((l) => l.stations.some((s) => s.name === name))
      this.cityLabelCands.push({
        obj: lobj,
        name,
        districtId: nameDistrict[name] || null,
        transfer: linesWithName.length > 1,
        prio: linesWithName.length > 1 ? 2 : 1,
        w: name.length * 13 + 18,
        h: 22
      })
      lobj.element.addEventListener('click', () => {
        const cand = this.cityLabelCands.find((c) => c.obj === lobj)
        this.callbacks.onSelectLandmark({ type: 'station', name, districtId: cand ? cand.districtId : null })
      })
    }
  }

  /**
   * 城市层站名标签屏幕避让（轻量版地铁层算法）：
   * 换乘站常显；选中区划时该区站名全显；按屏幕 x 贪心碰撞剔除。
   */
  cullCityLabels() {
    const el = this.renderer.domElement
    const w = el.clientWidth
    const h = el.clientHeight
    const v = new THREE.Vector3()
    const placed = []
    const list = []
    for (const c of this.cityLabelCands) {
      const show = c.transfer || (this.selectedId && c.districtId === this.selectedId)
      if (!show) {
        c.obj.visible = false
        continue
      }
      c.obj.getWorldPosition(v)
      v.project(this.camera)
      if (v.z > 1 || v.z < -1) {
        c.obj.visible = false
        continue
      }
      list.push({ ...c, sx: (v.x * 0.5 + 0.5) * w, sy: (-v.y * 0.5 + 0.5) * h })
    }
    list.sort((a, b) => b.prio - a.prio || a.sx - b.sx)
    for (const c of list) {
      const box = { x1: c.sx - c.w / 2, x2: c.sx + c.w / 2, y1: c.sy - c.h, y2: c.sy }
      const collides = placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)
      c.obj.visible = !collides
      if (!collides) placed.push(box)
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
    if (this.stationPins) targets.push(this.stationPins.inst)
    const hits = this.raycaster.intersectObjects(targets, false)
    return hits.length ? hits[0].object : null
  }

  /** 只清视觉高亮，不动 pointer（点击命中结果已存在 tapHit 里） */
  clearHoverVisual() {
    this.hoverId = null
    for (const d of districts) {
      const entry = this.districtGroups[d.districtId]
      if (!entry || !entry.mat || d.districtId === this.selectedId) continue
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
        if (!entry || !entry.mat) continue
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
    } else if (hit.userData.type === 'stationPin') {
      const info = this.stationPins && this.stationPins.list[hit.instanceId]
      if (info) this.callbacks.onSelectLandmark({ type: 'station', name: info.name, districtId: info.districtId })
    } else if (hit.userData.type === 'landmark' || hit.userData.type === 'station') {
      this.callbacks.onSelectLandmark(hit.userData)
    }
  }

  setSelected(id) {
    this.selectedId = id
    for (const d of districts) {
      const entry = this.districtGroups[d.districtId]
      if (!entry || !entry.mat) continue
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
      if (entry.edge) entry.edge.material.opacity = selected ? 0.9 : 0.35
      if (entry.group) entry.group.position.y = 0
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
    if (this.bloomPass) {
      const light = document.documentElement.classList.contains('theme-light')
      if (light) {
        this.bloomPass.strength = 0.18
        this.bloomPass.threshold = 0.85
        this.bloomPass.radius = 0.3
      } else {
        this.bloomPass.strength = 0.55
        this.bloomPass.threshold = 0.55
        this.bloomPass.radius = 0.4
      }
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
    if (this.composer) this.composer.setSize(w, h)

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
    this.cullCityLabels()
    if (!this.reduceMotion && this.landmarkMeshes) {
      const t = performance.now() / 1000
      for (const m of this.landmarkMeshes) {
        m.position.y = m.userData.baseY + Math.sin(t * 1.2 + m.userData.phase) * 2.4
      }
    }
    if (this.composer) this.composer.render(delta)
    else this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.controls.removeEventListener('controlstart', this._onUserInput)
    this.controls.dispose()
    if (this._stopObserving) this._stopObserving()
    if (this.composer) {
      try {
        this.composer.dispose()
      } catch {
        /* 个别版本无 dispose，忽略 */
      }
      this.composer = null
    }
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
    for (const l of [...this.districtLabelObjs, ...this.stationLabelObjs]) {
      this.scene.remove(l)
      if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element)
    }
    this.districtLabelObjs = []
    this.stationLabelObjs = []
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.removeEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.removeEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.removeEventListener('click', this._onClick)
    window.removeEventListener('resize', this._onResize)
  }
}
