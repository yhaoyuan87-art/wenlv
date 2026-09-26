import * as THREE from 'three'
import CameraControls from 'camera-controls'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { districts } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { plannedLines } from '../data/plannedLines.js'
import { poisByStation } from '../data/pois.js'
import { toXZ } from './CityScene.js'
import { pixelRatio, fitCamera, portraitPull, observeSize, isMobile } from './adapt.js'
import { cssVar, hexToNumber } from '../theme/theme.js'

CameraControls.install({ THREE })

const UP_Y = new THREE.Vector3(0, 1, 0)
const PLUS_Z = new THREE.Vector3(0, 0, 1)
/** 三节编组的车厢中心间距（弧长偏移，含 0.5 车厢间隙） */
const CAR_SPACING = 5.6

/** 车窗贴图：一条 4×n 亮窗的 canvas 纹理，横向重复铺在车窗灯带上，比整条实心带更像真车窗 */
function makeWindowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(224, 242, 255, 0.96)'
  for (let i = 0; i < 4; i += 1) ctx.fillRect(i * 16 + 3, 4, 10, 8)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(3, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class MetroScene {
  constructor(container, callbacks) {
    this.container = container
    this.callbacks = callbacks
    this.disposed = false
    this.selectedLineId = null
    this.selectedStationId = null
    this.reduceMotion = false
    this.clock = new THREE.Clock()
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2(-10, -10)
    this.downPos = null
    this.lineEntries = {}
    this.stationMeshes = []
    this.stationLabels = {}
    this.stationLabelObjs = {}
    this.labelCandidates = []
    this.labelSemantic = {}
    this.groundMats = []

    // ---- 列车模拟 ----
    this.trains = []
    this.trainBodies = []
    this.stationMeshById = {}
    this.pulses = [] // 进站脉冲 { mesh, base, ttl, dur }
    // ---- 列车跟随镜头 ----
    this.followTrain = null
    this._followLook = new THREE.Vector3()
    // ---- 路径规划叠加层 ----
    this.route = null
    this.routeLineIds = null
    this.elapsed = 0
    // ---- 站体剖面 ----
    this.section = null
    this.sectionLineIds = null
    // ---- 开场运镜 ----
    this._intro = null
    this._introLook = new THREE.Vector3()
    // ---- 自由漫游 ----
    this.lastInteraction = 0
    this.roaming = false
    this.roamAllowed = true
    this.roam = null
    this._roamLook = new THREE.Vector3()
    // ---- 冰雪模式 ----
    this.winter = false
    this.snow = null
    this.snowMeta = null
    this.lastRippleAt = -10
    // ---- 规划幽灵层 / Bloom ----
    this.ghostEntries = []
    this.composer = null
    this.bloomPass = null
    this.hoverLineId = null

    this._onPointerDown = this.onPointerDown.bind(this)
    this._onPointerMove = this.onPointerMove.bind(this)
    this._onPointerLeave = this.onPointerLeave.bind(this)
    this._onPointerUp = this.onPointerUp.bind(this)
    this._onClick = this.onClick.bind(this)
    this._onResize = this.onResize.bind(this)
    this._onUserInput = () => { this.userMoved = true }

    this.pull = 1
    this.userMoved = false
    this.lastView = null
    this.tapHit = null
    this.stationHitMeshes = []
    this.labelScale = 1
    // 详情面板遮挡的安全区（px）与当前平滑插值值
    this.safeRight = 0
    this.safeBottom = 0
    this._offX = 0
    this._offY = 0

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this._sceneBg())
    this.scene.fog = new THREE.Fog(this._sceneBg(), 800, 1900)

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 4000)
    this.camera.position.set(-80, 420, 560)

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
    this.controls.maxPolarAngle = Math.PI / 2.1
    this.controls.minDistance = 60
    this.controls.maxDistance = 1400
    this.controls.smoothTime = 0.7
    this.controls.draggingSmoothTime = 0.15
    this.controls.dollyToCursor = false
    this.controls.addEventListener('controlstart', this._onUserInput)

    this.hemiLight = new THREE.HemisphereLight(0x8fb5ff, 0x141c30, 0.85)
    this.scene.add(this.hemiLight)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(200, 400, 100)
    this.scene.add(dir)

    this.buildGround()
    this.buildLines()
    this.buildTrains()
    this.buildLineComets()
    this.buildGhostLines()
    this.buildTransferGlows()
    this._initBloom()
    this.updateLabels(null, null)

    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave)
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp)
    this.renderer.domElement.addEventListener('pointercancel', this._onPointerUp)
    this.renderer.domElement.addEventListener('click', this._onClick)
    this._stopObserving = observeSize(container, this._onResize)

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
    // 手机端 CSS 把站名标签放大了，避让盒必须同步放大，否则会重叠
    this.labelScale = isMobile() ? 1.3 : 1
    this.updateLabelMetrics()
  }

  /** 按当前档位重算标签避让用的包围盒（字符数 × 单字宽 + 内边距） */
  updateLabelMetrics() {
    const s = this.labelScale
    for (const c of this.labelCandidates) {
      c.w = (c.chars * 12 + 26 + c.extra) * s
      c.h = 24 * s
    }
  }

  buildGround() {
    const grid = new THREE.GridHelper(2200, 44, 0x1b2a47, 0x121d33)
    grid.position.y = -2
    this.scene.add(grid)
    this.gridHelper = grid

    // 区划底图：离屏 canvas 合成（像素级填充天然无缝、后画覆盖先画无叠色），
    // 再作为整张纹理铺在地面——支持整体提亮与每个区的边缘微光
    const OFF_X = -60
    const OFF_Y = -160
    const W = 1340
    const H = 1010
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')
    for (const d of districts) {
      ctx.beginPath()
      d.polygon.forEach(([x, y], i) => {
        const px = x - OFF_X
        const py = y - OFF_Y
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.closePath()
      ctx.fillStyle = d.color
      ctx.fill()
      // 边缘微光：柔光描边 + 轻微外发光
      ctx.shadowColor = 'rgba(140, 220, 255, 0.85)'
      ctx.shadowBlur = 7
      ctx.strokeStyle = 'rgba(159, 216, 255, 0.4)'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const dGeo = new THREE.PlaneGeometry(W, H)
    const dMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const dMesh = new THREE.Mesh(dGeo, dMat)
    dMesh.rotation.x = -Math.PI / 2
    const c = toXZ(OFF_X + W / 2, OFF_Y + H / 2)
    dMesh.position.set(c.X, -1.9, c.Z)
    dMesh.userData = { type: 'districtCanvas' }
    this.scene.add(dMesh)
    this.groundMats.push({ mesh: dMesh, mat: dMat, id: 'all' })

    // 区名标签（数据 label 坐标，与地铁空间地面标签同源）
    for (const d of districts) {
      const labelDiv = document.createElement('div')
      labelDiv.className = 'metro-ground-label'
      labelDiv.textContent = d.name
      const { X, Z } = toXZ(d.label[0], d.label[1])
      const labelObj = new CSS2DObject(labelDiv)
      labelObj.position.set(X, 1, Z)
      this.scene.add(labelObj)
    }
  }

  buildLines() {
    metroLines.forEach((line, li) => {
      const group = new THREE.Group()
      const liftY = 10 + li * 2.4

      const pts = line.stations.map((s) => {
        const { X, Z } = toXZ(s.x, s.y)
        return new THREE.Vector3(X, liftY, Z)
      })
      // 折线参数化：累计弧长表（列车巡航 / 路径流光共用同一套采样）
      const cum = [0]
      for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
      const stationIndexById = {}
      const tubeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(line.color),
        emissive: new THREE.Color(line.color).multiplyScalar(0.45),
        roughness: 0.35,
        metalness: 0.2,
        transparent: true,
        opacity: 0.96
      })
      // 用「逐段圆柱 + 关节球」代替 TubeGeometry：
      // TubeGeometry 在折线拐角处的 Frenet 框架插值会把管体甩离站点柱体（对不上），
      // 圆柱端点严格落在站点坐标上，球体盖住接缝，任何转角都严丝合缝。
      const lineMeshes = []
      const UP = new THREE.Vector3(0, 1, 0)
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1]
        const b = pts[i]
        const dir = new THREE.Vector3().subVectors(b, a)
        const len = dir.length()
        if (len < 0.001) continue
        const segGeo = new THREE.CylinderGeometry(1.1, 1.1, len, 8, 1, false)
        const seg = new THREE.Mesh(segGeo, tubeMat)
        seg.position.copy(a).addScaledVector(dir, 0.5)
        seg.quaternion.setFromUnitVectors(UP, dir.clone().normalize())
        seg.userData = { type: 'line', lineId: line.lineId }
        group.add(seg)
        lineMeshes.push(seg)
      }
      const jointGeo = new THREE.SphereGeometry(1.15, 10, 8)
      for (const p of pts) {
        const joint = new THREE.Mesh(jointGeo, tubeMat)
        joint.position.copy(p)
        joint.userData = { type: 'line', lineId: line.lineId }
        group.add(joint)
        lineMeshes.push(joint)
      }

      // 底部光晕：低张力 CatmullRom 包住折线（光晕不怕轻微切角），
      // additive 半透明光带让管线浮出网格，Bloom 加持下呈霓虹灯管质感
      const haloCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(line.color),
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      group.add(new THREE.Mesh(new THREE.TubeGeometry(haloCurve, Math.min(pts.length * 4, 160), 2.8, 8, false), haloMat))

      const stationMeshes = []
      line.stations.forEach((s, si) => {
        stationIndexById[s.stationId] = si
        const { X, Z } = toXZ(s.x, s.y)
        const isTransfer = (s.transfer || []).length > 0
        const size = isTransfer ? 3.2 : 2.2
        const geo = new THREE.CylinderGeometry(size, size, 1.4, isTransfer ? 8 : 6)
        const mat = new THREE.MeshStandardMaterial({
          color: isTransfer ? 0xffffff : new THREE.Color(line.color),
          emissive: isTransfer ? 0x5577aa : new THREE.Color(line.color).multiplyScalar(0.5),
          roughness: 0.4,
          transparent: true,
          opacity: 1
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(X, liftY, Z)
        mesh.userData = { type: 'station', stationId: s.stationId, lineId: line.lineId }
        group.add(mesh)
        stationMeshes.push(mesh)
        this.stationMeshes.push(mesh)
        this.stationMeshById[s.stationId] = mesh

        // 触摸热区：站点柱体半径只有 2.2（屏幕上约 3px），手指根本点不中；
        // 叠一个不可见的大判定球（material.visible=false → 不渲染，但可被 raycast 命中）
        const hitR = isTransfer ? 11 : 8
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(hitR, 8, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        )
        hit.position.set(X, liftY, Z)
        hit.userData = { type: 'station', stationId: s.stationId, lineId: line.lineId }
        group.add(hit)
        this.stationHitMeshes.push(hit)

        const dropGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(X, liftY - 1, Z),
          new THREE.Vector3(X, -1.5, Z)
        ])
        const drop = new THREE.Line(
          dropGeo,
          new THREE.LineBasicMaterial({ color: new THREE.Color(line.color), transparent: true, opacity: 0.3 })
        )
        group.add(drop)

        const labelDiv = document.createElement('div')
        labelDiv.className = 'metro-station-label' + (isTransfer ? ' transfer' : '')
        labelDiv.innerHTML = `${s.name}${isTransfer ? '<i class="t-dot"></i>' : ''}`
        labelDiv.addEventListener('click', () => this.callbacks.onSelectStation(s.stationId))
        const labelObj = new CSS2DObject(labelDiv)
        labelObj.position.set(X, liftY + (isTransfer ? 6 : 4.5), Z)
        group.add(labelObj)
        this.stationLabels[s.stationId] = labelDiv
        this.stationLabelObjs[s.stationId] = labelObj
        this.labelCandidates.push({
          stationId: s.stationId,
          lineId: line.lineId,
          obj: labelObj,
          prio: isTransfer ? 2 : 1,
          // 实际包围盒在 updateLabelMetrics() 里按档位换算，这里只存原始参数
          chars: s.name.length,
          extra: isTransfer ? 14 : 0,
          w: 0,
          h: 0
        })
      })

      this.scene.add(group)
      this.lineEntries[line.lineId] = {
        group,
        tubeMat,
        haloMat,
        stationMeshes,
        liftY,
        lineMeshes,
        pts,
        cum,
        total: cum[cum.length - 1],
        stationIndexById,
        line
      }
    })
  }

  /**
   * 三节编组列车：铰接式过弯（每节车独立沿轨采样，弯道不切角），
   * 车窗灯带 + 头灯/红灯 + 车底光晕；几何全局共享一份，材质按线共享以便整线同步明暗。
   */
  buildTrains() {
    const CAR = { radius: 1.25, len: 2.6 } // 胶囊车体：总长 len + 2*radius
    const bodyGeo = new THREE.CapsuleGeometry(CAR.radius, CAR.len, 6, 12)
    bodyGeo.rotateX(Math.PI / 2)
    const winTex = makeWindowTexture()
    this._winTex = winTex
    const winGeo = new THREE.BoxGeometry(2.72, 0.62, CAR.len + 0.4) // 比车体直径略宽，侧面露出灯带
    const roofGeo = new THREE.BoxGeometry(1.3, 0.4, CAR.len * 0.52)
    const glowGeo = new THREE.CircleGeometry(2.3, 20)
    glowGeo.rotateX(-Math.PI / 2)
    const lightGeo = new THREE.SphereGeometry(0.55, 8, 8)
    this.trainBodies = []
    for (const line of metroLines) {
      const entry = this.lineEntries[line.lineId]
      if (!entry) continue
      const trainMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(line.color),
        emissive: new THREE.Color(line.color).multiplyScalar(0.75),
        emissiveIntensity: 1.05,
        roughness: 0.3,
        metalness: 0.25,
        transparent: true
      })
      const windowMat = new THREE.MeshBasicMaterial({ map: winTex, transparent: true, opacity: 0.95, depthWrite: false })
      const roofMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(line.color).multiplyScalar(0.55),
        roughness: 0.55,
        transparent: true
      })
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(line.color),
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true })
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true })
      entry.trainMat = trainMat
      entry.windowMat = windowMat
      entry.roofMat = roofMat
      entry.glowMat = glowMat
      entry.headMat = headMat
      entry.tailMat = tailMat
      for (let k = 0; k < 2; k += 1) {
        const cars = []
        for (let c = 0; c < 3; c += 1) {
          const car = new THREE.Group()
          const body = new THREE.Mesh(bodyGeo, trainMat)
          car.add(body)
          car.add(new THREE.Mesh(winGeo, windowMat))
          const roof = new THREE.Mesh(roofGeo, roofMat)
          roof.position.y = 1.32 // 骑在车体顶部，远景读出「车顶设备」剪影
          car.add(roof)
          const glow = new THREE.Mesh(glowGeo, glowMat)
          glow.position.y = -0.6 // 悬在轨道管上方的柔光晕
          car.add(glow)
          if (c === 0) {
            const head = new THREE.Mesh(lightGeo, headMat)
            head.position.z = CAR.len / 2 + CAR.radius
            car.add(head)
          }
          if (c === 2) {
            const tail = new THREE.Mesh(lightGeo, tailMat)
            tail.position.z = -(CAR.len / 2 + CAR.radius)
            car.add(tail)
          }
          body.userData = { type: 'train', lineId: line.lineId }
          this.trainBodies.push(body)
          this.scene.add(car)
          cars.push({ car, body })
        }
        const train = {
          lineId: line.lineId,
          dir: k === 0 ? 1 : -1,
          s: entry.total * (k === 0 ? 0.1 : 0.55),
          v: 0,
          cruise: 29,
          dwell: k * 0.4,
          cars
        }
        cars[0].body.userData.train = train
        cars[1].body.userData.train = train
        cars[2].body.userData.train = train
        train.nextIdx = train.dir > 0 ? 1 : entry.cum.length - 2
        this.trains.push(train)
      }
    }
  }

  /**
   * 规划线路幽灵层：半透明虚线全息 + 「规划中」标签，
   * 透明度随时间缓慢呼吸，与运营线路拉开「已建成 / 未来时」的观感差。
   */
  buildGhostLines() {
    plannedLines.forEach((gl, gi) => {
      const pts = gl.points.map(([x, y]) => {
        const { X, Z } = toXZ(x, y)
        return new THREE.Vector3(X, 15, Z)
      })
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineDashedMaterial({
        color: new THREE.Color(gl.color),
        dashSize: 6,
        gapSize: 5,
        transparent: true,
        opacity: 0.5
      })
      const lineObj = new THREE.Line(geo, mat)
      lineObj.computeLineDistances()
      this.scene.add(lineObj)
      const end = pts[pts.length - 1]
      const div = document.createElement('div')
      div.className = 'metro-ghost-label'
      div.textContent = `${gl.name} · ${gl.status}`
      const labelObj = new CSS2DObject(div)
      labelObj.position.copy(end).add(new THREE.Vector3(0, 12, 0))
      this.scene.add(labelObj)
      this.ghostEntries.push({ mat, phase: gi * 2.1 })
    })
  }

  /**
   * Bloom 后处理：仅桌面端启用（移动端 GPU 预算留给渲染本身），
   * 强度/阈值随主题切换——夜间浓霓虹、白天轻提亮避免整屏过曝。
   */
  _initBloom() {
    if (isMobile()) return
    try {
      const w = this.container.clientWidth || 1
      const h = this.container.clientHeight || 1
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.75, 0.45, 0.5)
      this.composer.addPass(this.bloomPass)
      this.composer.addPass(new OutputPass())
    } catch (err) {
      // 后处理初始化失败不致命：退回直渲
      console.warn('[MetroScene] Bloom 初始化失败，使用直渲', err)
      this.composer = null
      this.bloomPass = null
    }
  }

  /** 折线上按弧长取点：返回位置与切线（列车 / 跟随镜头 / 流光粒子共用） */
  _sample(pts, cum, s) {
    const total = cum[cum.length - 1]
    const t = THREE.MathUtils.clamp(s, 0, total)
    let i = 1
    while (i < cum.length - 1 && cum[i] < t) i += 1
    const segLen = cum[i] - cum[i - 1] || 1
    const k = (t - cum[i - 1]) / segLen
    return {
      pos: new THREE.Vector3().lerpVectors(pts[i - 1], pts[i], k),
      tangent: new THREE.Vector3().subVectors(pts[i], pts[i - 1]).normalize()
    }
  }

  /**
   * 推进一列车：牵引加速度 / 进站制动（v²/2a 刹车距离）→ 平滑停靠；
   * 越过站点弧长时吸附进站，端点折返。reduceMotion 时完全冻结。
   */
  _advanceTrain(train, dt) {
    const entry = this.lineEntries[train.lineId]
    if (train.dwell > 0) {
      train.dwell -= dt
      return
    }
    const cum = entry.cum
    const ACCEL = 64
    const remain = (cum[train.nextIdx] - train.s) * train.dir
    const brakeDist = (train.v * train.v) / (2 * ACCEL)
    if (remain <= brakeDist) train.v = Math.max(0, train.v - ACCEL * dt)
    else train.v = Math.min(train.cruise, train.v + ACCEL * dt)
    const next = train.s + train.v * dt * train.dir
    if ((next - cum[train.nextIdx]) * train.dir >= 0) {
      // 进站：吸附到站台弧长，停靠后按折返 / 继续行驶更新下一目标
      const idx = train.nextIdx
      train.s = cum[idx]
      train.v = 0
      train.dwell = 0.75
      this._pulseStation(entry, idx)
      this._flashStationLabel(entry, idx)
      // 进站波纹降频：全局冷却 1.4s + 仅聚焦线路触发，避免全网此起彼伏过于嘈杂
      const stMesh = entry.stationMeshes[idx]
      if (
        stMesh &&
        this.elapsed - this.lastRippleAt > 1.4 &&
        (!this.selectedLineId || this.selectedLineId === train.lineId)
      ) {
        this.lastRippleAt = this.elapsed
        this.spawnRipple(stMesh.position.x, stMesh.position.z, entry.tubeMat.color)
      }
      const len = cum.length
      if (idx === 0) {
        train.dir = 1
        train.nextIdx = 1
      } else if (idx === len - 1) {
        train.dir = -1
        train.nextIdx = len - 2
      } else {
        train.nextIdx = idx + train.dir
      }
    } else {
      train.s = next
    }
  }

  /** 进站脉冲：站台柱体短暂鼓一下，给静态网络加入「时刻感」 */
  _pulseStation(entry, idx) {
    const mesh = entry.stationMeshes[idx]
    if (!mesh) return
    this.pulses.push({ mesh, base: mesh.scale.clone(), ttl: 0.8, dur: 0.8 })
  }

  /** 进站时站名标签亮一下（列车到站的「报站」感） */
  _flashStationLabel(entry, idx) {
    const station = entry.line && entry.line.stations[idx]
    const el = station && this.stationLabels[station.stationId]
    if (!el) return
    el.classList.add('arriving')
    clearTimeout(this._arriveTimers?.[station.stationId])
    if (!this._arriveTimers) this._arriveTimers = {}
    this._arriveTimers[station.stationId] = setTimeout(() => {
      el.classList.remove('arriving')
      delete this._arriveTimers[station.stationId]
    }, 950)
  }

  _updatePulses(dt) {
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const p = this.pulses[i]
      p.ttl -= dt
      if (p.ttl <= 0) {
        // 恢复基准缩放：选中站由 highlightLine 维护（1.35），非选中站恒为 1
        const sel = this.selectedStationId
        if (!sel || p.mesh.userData.stationId !== sel) p.mesh.scale.set(1, 1, 1)
        this.pulses.splice(i, 1)
        continue
      }
      const k = 1 - p.ttl / p.dur
      p.mesh.scale.copy(p.base).multiplyScalar(1 + Math.sin(k * Math.PI) * 0.45)
    }
  }

  /** 车厢中心相对车头节的前后偏移（弧长）：前节 +5.6 / 中间 0 / 尾节 -5.6 */
  _updateTrains(dt) {
    for (const train of this.trains) {
      // 物理冻结但仍然摆位：否则 reduceMotion 下 14 列列车全堆在世界原点
      if (!this.reduceMotion) this._advanceTrain(train, dt)
      const entry = this.lineEntries[train.lineId]
      for (let i = 0; i < train.cars.length; i += 1) {
        const { car } = train.cars[i]
        const off = (CAR_SPACING - i * CAR_SPACING) * train.dir
        const { pos, tangent } = this._sample(entry.pts, entry.cum, train.s + off)
        if (train.dir < 0) tangent.negate()
        car.position.set(pos.x, entry.liftY + 2, pos.z)
        car.quaternion.setFromUnitVectors(PLUS_Z, tangent)
      }
    }
  }

  /** 进入列车跟随镜头：相机锁在车尾侧上方，视线前探（controls 暂时让位） */
  startFollow(train) {
    this.followTrain = train
    this.controls.enabled = false
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    // 平滑起播：视线目标从「当前朝向前方」渐变到列车前方，避免第一帧硬切
    this._followLook.copy(this.camera.position).addScaledVector(dir, 80)
    this.callbacks.onFollowChange?.(true)
  }

  exitFollow() {
    if (!this.followTrain) return
    this.followTrain = null
    this.controls.enabled = true
    this.callbacks.onFollowChange?.(false)
  }

  _updateFollow(dt) {
    const train = this.followTrain
    if (!train) return
    const entry = this.lineEntries[train.lineId]
    const { pos, tangent } = this._sample(entry.pts, entry.cum, train.s)
    if (train.dir < 0) tangent.negate()
    // 机位：车尾后上方 + 向右侧偏移一点，比正后方对称机位更有「乘车感」
    const right = new THREE.Vector3().crossVectors(tangent, UP_Y).normalize()
    const camPos = pos
      .clone()
      .addScaledVector(tangent, -46)
      .addScaledVector(UP_Y, 24)
      .addScaledVector(right, 9)
    this.camera.position.lerp(camPos, 1 - Math.exp(-dt * 3.2))
    this._followLook.lerp(pos.clone().addScaledVector(tangent, 36), Math.min(1, dt * 6))
    this.camera.lookAt(this._followLook)
  }

  /**
   * 电影式开场：贴着 1 号线低位起步 → 拉升翻出地面 → 落到全网俯瞰。
   * 每会话只播一次（sessionStorage）；任何主动镜头操作都会打断；
   * reduceMotion 直接不播。返回是否真的开始播放。
   */
  playIntro() {
    if (this.reduceMotion || this._intro) return false
    try {
      if (sessionStorage.getItem('ccmetro-intro')) return false
    } catch {
      return false
    }
    const entry = this.lineEntries['line-01']
    if (!entry) return false
    const mid = entry.pts[Math.floor(entry.pts.length / 2)]
    this._startIntro(
      [
        // 起步：贴轨低位沿行进方向前探（像坐在车头上）
        { pos: new THREE.Vector3(mid.x + 12, 7, mid.z + 30), look: new THREE.Vector3(mid.x - 70, 9, mid.z - 90) },
        // 中段：翻出地面，城市边缘入画
        { pos: new THREE.Vector3(-30, 230, 330), look: new THREE.Vector3(0, 0, 0) },
        // 落幅：默认全网机位（与 resetView 一致）
        { pos: new THREE.Vector3(-80, 420, 560), look: new THREE.Vector3(0, 0, 0) }
      ],
      4.4,
      true
    )
    return true
  }

  /**
   * 「从城市层下来」的下潜入场：从所选区划上空俯冲到全网机位。
   * 与 playIntro 共用镜头机制但不占用开场次数，每次带区划上下文进入都播。
   */
  playDive(districtId) {
    if (this.reduceMotion || this._intro) return false
    const d = districts.find((x) => x.districtId === districtId)
    if (!d) return false
    const { X, Z } = toXZ(d.label[0], d.label[1])
    this._startIntro(
      [
        { pos: new THREE.Vector3(X - 20, 640, Z + 70), look: new THREE.Vector3(X, 0, Z) },
        { pos: new THREE.Vector3(-60, 430, 480), look: new THREE.Vector3(0, 0, 0) },
        { pos: new THREE.Vector3(-80, 420, 560), look: new THREE.Vector3(0, 0, 0) }
      ],
      2.2,
      false
    )
    return true
  }

  _startIntro(keys, dur, persist) {
    this._intro = { t: 0, dur, keys }
    this.controls.enabled = false
    this.lastView = null
    if (persist) {
      try {
        sessionStorage.setItem('ccmetro-intro', '1')
      } catch {
        /* 无痕模式等场景下存不进去也就每页播放一次，无碍 */
      }
    }
  }

  /** 结束开场；settle=true 时无动画落位到默认机位，false 交由调用方接管镜头 */
  _finishIntro(settle) {
    if (!this._intro) return
    this._intro = null
    this.controls.enabled = true
    if (settle) {
      const pos = new THREE.Vector3(-80, 420, 560)
      const look = new THREE.Vector3(0, 0, 0)
      this.camera.position.copy(pos)
      this.camera.lookAt(look)
      this.lastView = { pos, look }
    }
  }

  _updateIntro(dt) {
    const intro = this._intro
    if (!intro) return
    intro.t += dt
    const k = intro.t / intro.dur
    if (k >= 1) {
      this._finishIntro(true)
      return
    }
    const smooth = (t) => t * t * (3 - 2 * t)
    let a
    let b
    let tt
    if (k < 0.55) {
      a = intro.keys[0]
      b = intro.keys[1]
      tt = smooth(k / 0.55)
    } else {
      a = intro.keys[1]
      b = intro.keys[2]
      tt = smooth((k - 0.55) / 0.45)
    }
    this.camera.position.lerpVectors(a.pos, b.pos, tt)
    this._introLook.lerpVectors(a.look, b.look, tt)
    this.camera.lookAt(this._introLook)
  }

  onPointerDown(e) {
    if (this._intro) {
      // 开场运镜中任意按压 = 跳过，本次点击不二次触发拾取
      this._finishIntro(true)
      this.tapHit = null
      return
    }
    if (this.followTrain) {
      // 跟随模式中任意按压视为「接管镜头」：先退出跟随，本次点击不再二次触发拾取
      this.exitFollow()
      this.tapHit = null
      return
    }
    this.downPos = { x: e.clientX, y: e.clientY }
    this.updatePointerFromEvent(e)
    // 触屏没有 hover，pointermove 不会在点击前触发；
    // 必须在 down 阶段就把命中结果算好，否则 click 时 raycast 用的还是旧坐标
    this.tapHit = this.pick()
  }

  onPointerUp(e) {
    if (e.pointerType && e.pointerType !== 'mouse') this.renderer.domElement.style.cursor = 'grab'
  }

  onPointerLeave() {
    this.pointer.set(-10, -10)
    this.renderer.domElement.style.cursor = 'grab'
    this.setHoverLine(null)
  }

  /** 线路悬停增亮：只改 hoverLineId 后统一走 _applyFocus，避免多处手写明暗 */
  setHoverLine(lid) {
    if (this.hoverLineId === lid) return
    this.hoverLineId = lid
    this._applyFocus()
  }

  updatePointerFromEvent(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  onPointerMove(e) {
    this.updatePointerFromEvent(e)
    const hit = this.pick()
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    this.setHoverLine(hit && hit.userData.type === 'line' ? hit.userData.lineId : null)
  }

  isDrag(e) {
    if (!this.downPos) return false
    return Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > (isMobile() ? 10 : 5)
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const targets = [...this.stationHitMeshes, ...this.trainBodies]
    for (const lid in this.lineEntries) targets.push(...this.lineEntries[lid].lineMeshes)
    const hits = this.raycaster.intersectObjects(targets.filter(Boolean), false)
    return hits.length ? hits[0].object : null
  }

  onClick(e) {
    if (this.isDrag(e)) {
      this.tapHit = null
      return
    }
    const hit = this.tapHit || this.pick()
    this.tapHit = null
    if (!hit) {
      // 点空白处：通知上层清除聚焦（选中的线路/站点），否则聚焦后无法退出
      this.callbacks.onEmptyClick?.()
      return
    }
    if (hit.userData.type === 'station') this.callbacks.onSelectStation(hit.userData.stationId)
    else if (hit.userData.type === 'line') this.callbacks.onSelectLine(hit.userData.lineId)
    else if (hit.userData.type === 'train') this.startFollow(hit.userData.train)
  }

  highlightLine(lineId, stationId) {
    this.selectedLineId = lineId
    this.selectedStationId = stationId
    this._applyFocus()
    for (const lid in this.lineEntries) {
      const entry = this.lineEntries[lid]
      entry.stationMeshes.forEach((m) => {
        const isSel = stationId && m.userData.stationId === stationId
        if (isSel) {
          m.material.color.set(0xffffff)
          m.material.emissive.set(0x38e1ff)
          m.scale.set(1.35, 1.9, 1.35)
        } else {
          m.scale.set(1, 1, 1)
        }
      })
    }
    this.updateLabels(lineId, stationId)
  }

  /**
   * 统一明暗，三级优先：路径规划 > 站体剖面 > 选中线路。
   * 管线 / 站点 / 列车 / 车头灯同源明暗，避免「线亮车暗」的割裂感。
   */
  _applyFocus() {
    for (const lid in this.lineEntries) {
      const entry = this.lineEntries[lid]
      const isFocus = this.routeLineIds
        ? this.routeLineIds.has(lid)
        : this.sectionLineIds
          ? this.sectionLineIds.has(lid)
          : !this.selectedLineId || lid === this.selectedLineId
      // hover 的线路额外增亮（只在聚焦态生效，压暗态保持低调）
      const hovered = this.hoverLineId === lid
      entry.tubeMat.opacity = isFocus ? 0.96 : 0.1
      entry.tubeMat.emissiveIntensity = isFocus ? (hovered ? 1.6 : 1) : 0.2
      entry.stationMeshes.forEach((m) => {
        m.material.opacity = isFocus ? 1 : 0.12
      })
      if (entry.haloMat) entry.haloMat.opacity = isFocus ? (hovered ? 0.18 : 0.08) : 0.02
      // 列车五件套同源明暗：车身 / 车窗 / 车顶 / 光晕 / 头灯 / 尾灯
      if (entry.trainMat) entry.trainMat.opacity = isFocus ? 1 : 0.16
      if (entry.windowMat) entry.windowMat.opacity = isFocus ? 0.95 : 0.08
      if (entry.roofMat) entry.roofMat.opacity = isFocus ? 0.95 : 0.1
      if (entry.glowMat) entry.glowMat.opacity = isFocus ? 0.22 : 0.03
      if (entry.headMat) entry.headMat.opacity = isFocus ? 1 : 0.15
      if (entry.tailMat) entry.tailMat.opacity = isFocus ? 1 : 0.15
    }
  }

  /**
   * 站体剖面模式：镜头钻入地下，展开 B1 站厅 / B2 站台两层剖视结构，
   * 含双侧站台、轨道与停站列车、出入口光柱；地面网络压暗成背景。
   * @returns 是否成功进入（站点无效返回 false）
   */
  enterSection(stationId) {
    if (!stationId) return false
    this.exitSection()
    this.exitFollow()
    let found = null
    for (const line of metroLines) {
      const st = line.stations.find((s) => s.stationId === stationId)
      if (st) {
        found = { line, st }
        break
      }
    }
    if (!found) return false
    const { X, Z } = toXZ(found.st.x, found.st.y)
    const accent = hexToNumber(cssVar('--accent'), 0x38e1ff)
    const isTransfer = (found.st.transfer || []).length > 0
    const W = isTransfer ? 56 : 44
    const D = 30
    const B1 = -14
    const B2 = -26

    const group = new THREE.Group()
    group.position.set(X, 0, Z)
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x2a3d63, roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.95 })
    const platMat = new THREE.MeshStandardMaterial({ color: 0x3a538a, roughness: 0.55, transparent: true, opacity: 0.95 })
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x182644, roughness: 0.8, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0d1626, roughness: 0.4, metalness: 0.5 })
    const rimMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 })
    const beamMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })

    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      group.add(m)
      return m
    }

    // B2 站台层：底板 + 双侧站台 + 双轨道 + 一列停站列车
    box(W, 0.8, D, slabMat, 0, B2 - 0.4, 0)
    box(W * 0.3, 1.1, D * 0.44, platMat, -W * 0.32, B2 + 0.55, 0)
    box(W * 0.3, 1.1, D * 0.44, platMat, W * 0.32, B2 + 0.55, 0)
    const trackLen = D - 8
    for (const tx of [-5, 5]) {
      const track = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, trackLen, 8), trackMat)
      track.rotation.x = Math.PI / 2
      track.position.set(tx, B2 + 1.4, 0)
      group.add(track)
    }
    const carGeo = new THREE.CapsuleGeometry(0.95, 2.2, 4, 10)
    carGeo.rotateX(Math.PI / 2)
    const parkedMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(found.line.color),
      emissive: new THREE.Color(found.line.color).multiplyScalar(0.6),
      emissiveIntensity: 0.9,
      roughness: 0.35,
      transparent: true
    })
    for (let c = -1; c <= 1; c += 1) {
      const car = new THREE.Mesh(carGeo, parkedMat)
      car.position.set(5, B2 + 2.5, c * 4)
      group.add(car)
    }

    // B1 站厅层：楼板
    box(W, 0.8, D, slabMat, 0, B1, 0)
    // 连接柱
    for (const cx of [-W * 0.34, W * 0.34]) {
      for (const cz of [-D * 0.3, D * 0.3]) {
        box(1.3, B1 - B2 - 0.8, 1.3, platMat, cx, (B1 + B2) / 2, cz)
      }
    }
    // 换乘站加一层夹层提示（B1 上方薄板）
    if (isTransfer) box(W * 0.7, 0.5, D * 0.6, platMat, 0, B1 + 3.2, 0)

    // 剖切围护：封闭背面与侧面，正面敞开供镜头观看；开口边缘加发光收边
    box(W, -B2, 0.8, wallMat, 0, B2 / 2, -D / 2)
    box(0.8, -B2, D, wallMat, -W / 2, B2 / 2, 0)
    box(W, 0.6, 0.8, rimMat, 0, -0.6, D / 2)
    box(0.8, 0.6, D, rimMat, W / 2, -0.6, 0)

    // 出入口光柱：从站台直通地面
    for (const [ex, ez] of [[W * 0.4, D * 0.32], [-W * 0.4, -D * 0.32]]) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, -B2 + 2, 12, 1, true), beamMat)
      beam.position.set(ex, (-B2 + 2) / 2 - 1, ez)
      group.add(beam)
    }

    // 深度标签
    const flags = []
    const mkLabel = (text, x, y, z) => {
      const div = document.createElement('div')
      div.className = 'section-depth-label'
      div.textContent = text
      const obj = new CSS2DObject(div)
      obj.position.set(x, y, z)
      group.add(obj)
      flags.push(obj)
    }
    mkLabel('B1 站厅层 -14m', W * 0.22, B1 + 3, D * 0.4)
    mkLabel('B2 站台层 -26m', W * 0.22, B2 + 3.4, D * 0.4)

    this.scene.add(group)
    this.section = { group, flags, stationId, lineId: found.line.lineId }
    this.sectionLineIds = new Set([found.line.lineId])
    this._applyFocus()
    this.updateLabels(found.line.lineId, stationId)
    // 镜头入地：斜俯视坑体（机位高于目标点，极角约束内）
    this.flyTo(new THREE.Vector3(X + 44, 4, Z + 88), new THREE.Vector3(X, -15, Z))
    this.callbacks.onSectionChange?.(true)
    return true
  }

  /** 退出剖面并恢复明暗（镜头交由调用方接管） */
  exitSection() {
    const sec = this.section
    if (!sec) return
    this.section = null
    this.sectionLineIds = null
    this.scene.remove(sec.group)
    sec.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
    for (const f of sec.flags) f.element.remove()
    this._applyFocus()
    this.updateLabels(this.selectedLineId, this.selectedStationId)
    this.callbacks.onSectionChange?.(false)
  }

  /**
   * 展示路径规划叠加层（route 结构见 data/routePlanner.js）：
   * 途经线路光晕管 + 沿全程流动的流光粒子（颜色跟随乘车段）+
   * 起终点旋转光环与旗标 + 换乘站呼吸脉冲；非途经线路整体压暗。
   */
  showRoute(route) {
    this.clearRoute()
    if (!route || !route.segments.length) return
    const group = new THREE.Group()
    const segs = []
    const segMats = []
    const glowSegs = []
    let total = 0
    for (const seg of route.segments) {
      const entry = this.lineEntries[seg.lineId]
      if (!entry) {
        segMats.push(null)
        continue
      }
      const pts = seg.stationIds
        .filter((sid) => sid in entry.stationIndexById)
        .map((sid) => entry.pts[entry.stationIndexById[sid]].clone().setY(entry.liftY + 0.5))
      if (pts.length < 2) {
        segMats.push(null)
        continue
      }
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(seg.color),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      const segGlowMeshes = this._tubeAlong(group, pts, 2.6, glowMat)
      const cum = [0]
      for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
      segs.push({ pts, cum, color: seg.color, base: total, len: cum[cum.length - 1] })
      segMats.push(glowMat)
      // 描线动画：记录每根管（锚点/方向/长度），所属段起点与段长（换算全程占比在循环外）
      for (const g of segGlowMeshes) {
        glowSegs.push({ ...g, segBase: total, segLen: cum[cum.length - 1] })
      }
      total += cum[cum.length - 1]
    }
    if (!segs.length || total <= 0) {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
      return
    }
    // 全程占比换算：[f0, f1] 为该管在整条路线上的弧长区间
    for (const g of glowSegs) {
      g.f0 = g.segBase / total
      g.f1 = (g.segBase + g.segLen) / total
    }

    // 流光粒子：数量随路径长度伸缩，均匀散布、匀速循环
    const count = Math.max(8, Math.min(44, Math.round(total / 26)))
    const inst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.3, 8, 6),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      count
    )
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const states = []
    const tmpColor = new THREE.Color()
    for (let i = 0; i < count; i += 1) {
      const off = (i / count) * total
      const segIdx = this._findSeg(segs, off)
      states.push({ off, segIdx })
      inst.setColorAt(i, tmpColor.set(segs[segIdx].color))
    }
    group.add(inst)

    // 起终点：旋转光环 + CSS2D 旗标；带 markers（主题一日线序号气泡）时改用气泡
    const rings = []
    const flags = []
    if (route.markers && route.markers.length) {
      for (const mk of route.markers) {
        const entry = this.lineEntries[mk.lineId]
        const idx = entry && entry.stationIndexById[mk.stationId]
        if (idx == null) continue
        const p = entry.pts[idx]
        const div = document.createElement('div')
        div.className = 'route-num'
        div.textContent = mk.text
        if (mk.color) {
          div.style.background = mk.color
          div.style.boxShadow = `0 0 12px ${mk.color}66`
        }
        const obj = new CSS2DObject(div)
        obj.position.set(p.x, entry.liftY + 9, p.z)
        group.add(obj)
        flags.push(obj)
      }
    } else {
      ;[route.stations[0], route.stations[route.stations.length - 1]].forEach((st, i) => {
        const entry = this.lineEntries[st.lineId]
        const idx = entry && entry.stationIndexById[st.stationId]
        if (idx == null) return
        const p = entry.pts[idx]
        const ringGeo = new THREE.TorusGeometry(5.4, 0.5, 10, 40)
        ringGeo.rotateX(Math.PI / 2)
        const ring = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({ color: i === 0 ? 0x38e1ff : 0xffb457, transparent: true, opacity: 0.9 })
        )
        ring.position.set(p.x, entry.liftY + 1.4, p.z)
        group.add(ring)
        rings.push(ring)
        const div = document.createElement('div')
        div.className = 'route-flag' + (i === 1 ? ' dest' : '')
        div.textContent = i === 0 ? '起点' : '终点'
        const obj = new CSS2DObject(div)
        obj.position.set(p.x, entry.liftY + 9.5, p.z)
        group.add(obj)
        flags.push(obj)
      })
    }

    // 换乘站呼吸脉冲（记录基准缩放，清除时还原）；终点站若是「到站即换乘」不做脉冲
    const pulseMeshes = []
    for (const st of route.stations) {
      if (!st.transferIn || st.stationId === route.destId) continue
      const mesh = this.stationMeshById[st.stationId]
      if (mesh) pulseMeshes.push({ mesh, base: mesh.scale.clone() })
    }

    this.route = { group, inst, states, segs, segMats, total, rings, flags, pulseMeshes, glowSegs, drawT: this.reduceMotion ? 1 : 0 }
    this.routeLineIds = new Set(route.segments.map((s) => s.lineId))
    this.scene.add(group)
    this._applyFocus()
  }

  /** 清除路径叠加层，并把明暗恢复为「按当前选中线路聚焦」 */
  clearRoute() {
    const r = this.route
    this.route = null
    this.routeLineIds = null
    if (!r) return
    this.scene.remove(r.group)
    r.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
    for (const f of r.flags) f.element.remove()
    for (const p of r.pulseMeshes) p.mesh.scale.copy(p.base)
    this._applyFocus()
  }

  /** 沿折线铺发光管：开式圆柱端点严格落在站点上，与主线路同构；返回每根管的锚点信息（描线动画用） */
  _tubeAlong(parent, pts, radius, mat) {
    const meshes = []
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]
      const b = pts[i]
      const dir = new THREE.Vector3().subVectors(b, a)
      const len = dir.length()
      if (len < 0.001) continue
      const segGeo = new THREE.CylinderGeometry(radius, radius, len, 8, 1, true)
      const seg = new THREE.Mesh(segGeo, mat)
      seg.position.copy(a).addScaledVector(dir, 0.5)
      seg.quaternion.setFromUnitVectors(UP_Y, dir.clone().normalize())
      parent.add(seg)
      meshes.push({ mesh: seg, a: a.clone(), dir: dir.clone(), len })
    }
    return meshes
  }

  /** 按全程偏移量定位所在乘车段（segs 按 base 升序） */
  _findSeg(segs, off) {
    for (let i = segs.length - 1; i >= 0; i -= 1) {
      if (off >= segs[i].base) return i
    }
    return 0
  }

  /** 行程卡 hover 联动：高亮对应乘车段的光晕，其余段压暗；null 恢复 */
  emphasizeSegment(idx) {
    const r = this.route
    if (!r || !r.segMats) return
    r.segMats.forEach((m, i) => {
      if (!m) return
      m.opacity = idx == null ? 0.3 : i === idx ? 0.62 : 0.1
    })
  }

  _updateRoute(dt) {
    const r = this.route
    if (!r) return
    // 描线动画：glow 管按全程弧长比例从起点逐渐「画」到终点
    if (r.drawT < 1) {
      r.drawT = Math.min(1, r.drawT + dt / 1.6)
      for (const g of r.glowSegs) {
        const frac = (r.drawT - g.f0) / Math.max(g.f1 - g.f0, 0.0001)
        const clamped = THREE.MathUtils.clamp(frac, 0, 1)
        g.mesh.visible = clamped > 0.001
        g.mesh.scale.y = Math.max(clamped, 0.001)
        g.mesh.position.copy(g.a).addScaledVector(g.dir, (g.len * clamped) / 2)
      }
    }
    if (!this.reduceMotion) {
      const m = new THREE.Matrix4()
      const col = new THREE.Color()
      for (let i = 0; i < r.states.length; i += 1) {
        const st = r.states[i]
        st.off = (st.off + dt * 55) % r.total
        const segIdx = this._findSeg(r.segs, st.off)
        const seg = r.segs[segIdx]
        const { pos } = this._sample(seg.pts, seg.cum, st.off - seg.base)
        m.makeTranslation(pos.x, pos.y + 1.9, pos.z)
        r.inst.setMatrixAt(i, m)
        if (st.segIdx !== segIdx) {
          st.segIdx = segIdx
          r.inst.setColorAt(i, col.set(seg.color))
          r.inst.instanceColor.needsUpdate = true
        }
      }
      r.inst.instanceMatrix.needsUpdate = true
    }
    // 换乘站呼吸脉冲
    const k = 1 + 0.32 * (0.5 + 0.5 * Math.sin(this.elapsed * 6))
    for (const p of r.pulseMeshes) p.mesh.scale.copy(p.base).multiplyScalar(k)
    // 起终点环旋转 + 呼吸
    for (const ring of r.rings) {
      ring.rotation.z += dt * 1.1
      ring.scale.setScalar(1 + 0.09 * Math.sin(this.elapsed * 3))
    }
  }

  updateLabels(lineId, stationId) {
    const usedNames = new Set()
    for (const line of metroLines) {
      const isFocus = !lineId || line.lineId === lineId
      // 聚焦某条线路时，该线全部站点名都显示（非聚焦线仍只留换乘站/选中站）
      const allLine = lineId && line.lineId === lineId
      for (const s of line.stations) {
        const el = this.stationLabels[s.stationId]
        const obj = this.stationLabelObjs[s.stationId]
        if (!el || !obj) continue
        const hasPoi = poisByStation(s.stationId).length > 0
        const isTransfer = (s.transfer || []).length > 0
        const isSel = s.stationId === stationId
        let show = isSel || allLine || (isFocus && (isTransfer || hasPoi))
        if (show && usedNames.has(s.name) && !isSel) show = false
        if (show) usedNames.add(s.name)
        this.labelSemantic[s.stationId] = show
        el.classList.toggle('selected', isSel)
        // 非聚焦线的标签压暗，聚焦时不抢戏（选中站永远清晰）
        el.classList.toggle('dim', !isFocus && !isSel)
      }
    }
  }

  cullLabels() {
    // 漫游穿行楼群时站名标签会随视角高频翻转闪烁（「一卡一卡」的观感来源），
    // 漫游期间干脆全部隐藏，画面干净
    if (this.roaming) {
      for (const c of this.labelCandidates) if (c.obj) c.obj.visible = false
      return
    }
    const el = this.renderer.domElement
    const w = el.clientWidth
    const h = el.clientHeight
    const v = new THREE.Vector3()
    const cands = []
    for (const c of this.labelCandidates) {
      const obj = c.obj
      if (!obj || !this.labelSemantic[c.stationId]) {
        if (obj) obj.visible = false
        continue
      }
      obj.getWorldPosition(v)
      v.project(this.camera)
      if (v.z > 1 || v.z < -1) {
        obj.visible = false
        continue
      }
      cands.push({
        stationId: c.stationId,
        lineId: c.lineId,
        prio: c.prio,
        w: c.w,
        h: c.h,
        obj,
        sx: (v.x * 0.5 + 0.5) * w,
        sy: (-v.y * 0.5 + 0.5) * h
      })
    }

    const hits = (box, placed) => placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)
    // 行 r 的包围盒：r=0 紧贴锚点，r 增大逐行远离（上方 / 下方两侧独立编号）
    const band = (c, r, above) =>
      above
        ? { x1: c.sx - c.w / 2, x2: c.sx + c.w / 2, y1: c.sy - (r + 1) * c.h, y2: c.sy - r * c.h }
        : { x1: c.sx - c.w / 2, x2: c.sx + c.w / 2, y1: c.sy + r * c.h, y2: c.sy + (r + 1) * c.h }

    // 聚焦线路（且无规划叠加）时：该线站名「全部显示」，按屏幕 x 排序后
    // 上/下各最多 3 行贪心堆叠；行高用 CSS2DObject.center 百分比锚点实现
    const focusActive = this.selectedLineId && !this.routeLineIds
    const focused = focusActive ? cands.filter((c) => c.lineId === this.selectedLineId) : []
    const others = focusActive ? cands.filter((c) => c.lineId !== this.selectedLineId) : cands

    const placed = []
    others.sort((a, b) => b.prio - a.prio)
    for (const c of others) {
      const box = band(c, 0, true)
      const collides = hits(box, placed)
      c.obj.visible = !collides
      if (collides) continue
      c.obj.center.set(0.5, 1) // 锚点 = 元素底部中位（挂在站点上方）
      placed.push(box)
    }

    focused.sort((a, b) => b.prio - a.prio || a.sx - b.sx)
    const MAX_ROW = 3
    for (const c of focused) {
      let done = false
      for (let r = 0; r < MAX_ROW && !done; r += 1) {
        const box = band(c, r, true)
        if (!hits(box, placed)) {
          c.obj.center.set(0.5, 1 + r)
          c.obj.visible = true
          placed.push(box)
          done = true
        }
      }
      for (let r = 0; r < MAX_ROW && !done; r += 1) {
        const box = band(c, r, false)
        if (!hits(box, placed)) {
          c.obj.center.set(0.5, -r)
          c.obj.visible = true
          placed.push(box)
          done = true
        }
      }
      if (!done) c.obj.visible = false
    }
  }

  focusStation(stationId) {
    for (const line of metroLines) {
      const s = line.stations.find((x) => x.stationId === stationId)
      if (s) {
        const { X, Z } = toXZ(s.x, s.y)
        this.flyTo(new THREE.Vector3(X - 30, 130, Z + 120), new THREE.Vector3(X, 10, Z))
        return
      }
    }
  }

  focusLine(lineId) {
    const line = metroLines.find((l) => l.lineId === lineId)
    if (!line) return
    const mid = line.stations[Math.floor(line.stations.length / 2)]
    const { X, Z } = toXZ(mid.x, mid.y)
    this.flyTo(new THREE.Vector3(X - 60, 330, Z + 320), new THREE.Vector3(X, 10, Z))
  }

  resetView() {
    this.exitFollow()
    this.flyTo(new THREE.Vector3(-80, 420, 560), new THREE.Vector3(0, 0, 0), !this.lastView)
  }

  topView() {
    this.exitFollow()
    this.flyTo(new THREE.Vector3(0, 980, 4), new THREE.Vector3(0, 0, 0), true)
  }

  /**
   * @param animate 是否补间；false 用于首帧定位与旋转屏后的重新构图
   */
  flyTo(pos, look, animate = true) {
    this.markInteraction()
    if (this._intro) this._finishIntro(false)
    this.lastView = { pos: pos.clone(), look: look.clone() }
    const p = new THREE.Vector3(
      look.x + (pos.x - look.x) * this.pull,
      look.y + (pos.y - look.y) * this.pull,
      look.z + (pos.z - look.z) * this.pull
    )
    this.controls.setLookAt(p.x, p.y, p.z, look.x, look.y, look.z, animate && !this.reduceMotion)
  }

  /** 从 CSS 变量读取场景背景色（Metro 默认为更深的夜空蓝） */
  _sceneBg() {
    const hex = cssVar('--scene-bg')
    return hexToNumber(hex, 0x070c17)
  }

  /** 主题切换：同步场景背景、雾、网格与灯光反射色；Bloom 参数随主题自适应 */
  setTheme() {
    const bg = this._sceneBg()
    if (this.scene.background) this.scene.background.set(bg)
    if (this.scene.fog) this.scene.fog.color.set(bg)
    if (this.gridHelper) {
      this.gridHelper.material.color.set(hexToNumber(cssVar('--scene-grid'), 0x1b2a47))
    }
    if (this.hemiLight) {
      this.hemiLight.groundColor.set(hexToNumber(cssVar('--scene-bounce'), 0x141c30))
    }
    // 冰雪模式：雪地平面懒构建（半透明盖住网格，营造结霜地面）
    if (this.winter && !this.snowGround) {
      const g = new THREE.PlaneGeometry(2200, 1800)
      const m = new THREE.MeshBasicMaterial({
        color: 0x8fb3d9,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      })
      this.snowGround = new THREE.Mesh(g, m)
      this.snowGround.rotation.x = -Math.PI / 2
      this.snowGround.position.y = -1.6
      this.scene.add(this.snowGround)
    }
    if (this.snowGround) {
      this.snowGround.visible = this.winter
      // 夜间雪地压暗到冰蓝，让饱和线路与辉光保持对比
      this.snowGround.material.color.set(cityLight ? 0xd9e5f1 : 0x5d7ba6)
      this.snowGround.material.opacity = this.winter ? (cityLight ? 0.3 : 0.22) : 0
    }
    // 氛围层主题联动：星星仅夜间可见，微尘白天降透明
    const cityLight = document.documentElement.classList.contains('theme-light')
    if (this.stars) this.stars.visible = !cityLight
    if (this.dustMat) this.dustMat.opacity = cityLight ? 0.28 : 0.5
    if (this.bloomPass) {
      const light = document.documentElement.classList.contains('theme-light')
      if (light) {
        this.bloomPass.strength = 0.22
        this.bloomPass.threshold = 0.85
        this.bloomPass.radius = 0.3
      } else {
        this.bloomPass.strength = 0.75
        this.bloomPass.threshold = 0.5
        this.bloomPass.radius = 0.45
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
    if (v && this.roaming) this.exitRoam()
  }

  /** 用户交互打点（拖拽/缩放/点击/按键），用于闲置判定与退出漫游 */
  markInteraction() {
    this.lastInteraction = this.elapsed
    if (this.roaming) this.exitRoam()
  }

  setRoamAllowed(v) {
    this.roamAllowed = v
    if (!v && this.roaming) this.exitRoam()
  }

  /** 自由漫游：手动开启，相机沿线网缓慢巡航，任意交互退出 */
  enterRoam() {
    if (this.roaming || this.reduceMotion || this.followTrain || this._intro || this.section) return
    const ids = Object.keys(this.lineEntries)
    if (!ids.length) return
    this.roam = {
      lineId: ids[Math.floor(Math.random() * ids.length)],
      s: Math.random() * 0.3,
      dir: 1
    }
    this.roamBlend = 0
    this.roaming = true
    this.controls.enabled = false
    const dirV = new THREE.Vector3()
    this.camera.getWorldDirection(dirV)
    this._roamLook.copy(this.camera.position).addScaledVector(dirV, 120)
    this.callbacks.onRoamChange?.(true)
  }

  exitRoam() {
    if (!this.roaming) return
    this.roaming = false
    this.roam = null
    this.controls.enabled = true
    this.callbacks.onRoamChange?.(false)
  }

  _updateRoam(dt) {
    if (!this.roaming || !this.roam) return
    const entry = this.lineEntries[this.roam.lineId]
    if (!entry) {
      this.exitRoam()
      return
    }
    // 入场平滑过渡（1.5s），之后按弧长参数化**匀速直读**——
    // 不做每帧 lerp 追赶（目标本身在动，追赶式 lerp 会产生非匀速顿挫）
    this.roamBlend = Math.min(1, (this.roamBlend || 0) + dt / 1.5)
    this.roam.s += dt * 34 * this.roam.dir
    if (this.roam.s >= entry.total) {
      // 到达端点：换一条随机线继续巡游
      const ids = Object.keys(this.lineEntries).filter((id) => id !== this.roam.lineId)
      this.roam.lineId = ids[Math.floor(Math.random() * ids.length)]
      this.roam.s = 0
    }
    const next = this.lineEntries[this.roam.lineId]
    const { pos, tangent } = this._sample(next.pts, next.cum, this.roam.s)
    if (this.roam.dir < 0) tangent.negate()
    const camPos = pos.clone().addScaledVector(tangent, -150).add(new THREE.Vector3(0, 95, 0))
    const look = pos.clone().addScaledVector(tangent, 70)
    if (this.roamBlend < 1) {
      const k = 1 - Math.exp(-dt * 2.2)
      this.camera.position.lerp(camPos, k)
      this._roamLook.lerp(look, Math.min(1, dt * 2.5))
      this.camera.lookAt(this._roamLook)
    } else {
      this.camera.position.copy(camPos)
      this.camera.lookAt(look)
    }
  }

  /** 冰雪模式 v2：雪落在「该落的地方」——线路覆雪、车顶积雪、地面结霜、呼吸变慢 */
  setWinter(v) {
    this.winter = v
    if (v && !this.snow) this._buildSnow()
    if (this.snow) this.snow.visible = v
    // 线路/列车「冬季增强」：本色保持饱和，发光增强——浅色雪地上
    // 饱和色 + 强辉光才有对比（往白里调反而和雪地融成一片）
    const WHITE = new THREE.Color(0xeef4ff)
    for (const line of metroLines) {
      const entry = this.lineEntries[line.lineId]
      if (!entry) continue
      const base = new THREE.Color(line.color)
      entry.tubeMat.color.copy(base)
      entry.tubeMat.emissive.copy(base.clone().multiplyScalar(v ? 0.85 : 0.45))
      if (entry.trainMat) {
        entry.trainMat.color.copy(base)
        entry.trainMat.emissive.copy(base.clone().multiplyScalar(v ? 1 : 0.75))
      }
      if (entry.roofMat) {
        // 车顶积雪：冬季顶棚近乎纯白
        entry.roofMat.color.copy(v ? new THREE.Color(0xe9f1fa) : new THREE.Color(base).multiplyScalar(0.55))
      }
    }
    this.setTheme()
  }

  _buildSnow() {
    const n = isMobile() ? 450 : 1000
    const pos = new Float32Array(n * 3)
    this.snowMeta = []
    for (let i = 0; i < n; i += 1) {
      const x = -700 + Math.random() * 1400
      const y = Math.random() * 230
      const z = -460 + Math.random() * 920
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      this.snowMeta.push({ speed: 8 + Math.random() * 14, sway: 3 + Math.random() * 6, phase: Math.random() * Math.PI * 2, bx: x })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    this.snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    })
    this.snow = new THREE.Points(geo, this.snowMat)
    this.snow.name = 'snow'
    this.snow.visible = this.winter
    this.scene.add(this.snow)
  }

  _updateSnow(dt) {
    if (!this.snow || !this.snow.visible || this.reduceMotion) return
    const t = this.elapsed
    const pos = this.snow.geometry.attributes.position
    for (let i = 0; i < this.snowMeta.length; i += 1) {
      const m = this.snowMeta[i]
      let y = pos.array[i * 3 + 1] - m.speed * dt
      if (y < 0) y += 230
      pos.array[i * 3 + 1] = y
      pos.array[i * 3] = m.bx + Math.sin(t * 0.6 + m.phase) * m.sway
    }
    pos.needsUpdate = true
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

    if (this.lastView && !this.userMoved && Math.abs(prevPull - this.pull) > 0.001) {
      const { pos, look } = this.lastView
      this.flyTo(pos, look, false)
    }
  }

  animate() {
    if (this.disposed) return
    requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()
    this.elapsed += delta
    this.controls.update(delta)
    this._updateViewOffset(delta)
    this._updateIntro(delta)
    this._updateTrains(delta)
    this._updateFollow(delta)
    this._updatePulses(delta)
    this._updateRoute(delta)
    this._updateGhost(delta)
    this._updateTransferGlows()
    this._updateRipples(delta)
    this._updateComets(delta)
    this._updateRoam(delta)
    this._updateSnow(delta)
    this.cullLabels()
    if (this.composer) this.composer.render(delta)
    else this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  /** 幽灵层呼吸（base 可选：机场弧线用更高基准透明度） */
  _updateGhost() {
    for (const g of this.ghostEntries) {
      const base = g.base || 0.38
      const amp = g.base ? 0.12 : 0.16
      g.mat.opacity = base + amp * Math.sin(this.elapsed * 1.8 + g.phase)
    }
  }

  /**
   * 氛围层：夜空星星穹顶 + 场内漂浮微尘（Points，性能极轻）。
   * 星星仅夜间主题显示；移动端数量减半。
   */
/** 微尘漂浮 + 星星呼吸 */
/**
   * 换乘站能量井：渐变光柱 + 贴地光圈呼吸（20 个换乘站，枢纽地标感）。
   * 材质每站独立以便相位错开的呼吸。
   */
  buildTransferGlows() {
    const seen = new Set()
    this.transferGlows = []
    for (const line of metroLines) {
      for (const st of line.stations) {
        if (!(st.transfer || []).length || seen.has(st.name)) continue
        seen.add(st.name)
        const { X, Z } = toXZ(st.x, st.y)
        const phase = Math.random() * Math.PI * 2
        const pillarMat = new THREE.MeshBasicMaterial({
          color: 0x9fd8ff,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 30, 12, 1, true), pillarMat)
        pillar.position.set(X, 15, Z)
        this.scene.add(pillar)
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x9fd8ff,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
        const ringGeo = new THREE.RingGeometry(4.6, 6.2, 30)
        ringGeo.rotateX(-Math.PI / 2)
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.position.set(X, 1.6, Z)
        this.scene.add(ring)
        this.transferGlows.push({ pillarMat, ringMat, ring, phase })
      }
    }
  }

  _updateTransferGlows() {
    if (this.reduceMotion) return
    const t = this.elapsed
    // 冬季呼吸变慢（寒冷感）：频率减半
    const rate = this.winter ? 0.8 : 1.6
    for (const g of this.transferGlows) {
      const k = 0.5 + 0.5 * Math.sin(t * rate + g.phase)
      g.pillarMat.opacity = 0.09 + 0.07 * k
      g.ringMat.opacity = 0.18 + 0.16 * k
      g.ring.scale.setScalar(1 + 0.09 * k)
    }
  }

  /** 进站波纹：列车停靠瞬间从站台扩散一圈涟漪 */
  spawnRipple(x, z, color) {
    if (this.reduceMotion) return
    if (!this.ripples) this.ripples = []
    if (this.ripples.length > 12) return
    const geo = new THREE.RingGeometry(3, 3.6, 30)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 1.7, z)
    this.scene.add(mesh)
    this.ripples.push({ mesh, ttl: 0.9, dur: 0.9 })
  }

  _updateRipples(dt) {
    if (!this.ripples) return
    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      const r = this.ripples[i]
      r.ttl -= dt
      if (r.ttl <= 0) {
        this.scene.remove(r.mesh)
        r.mesh.geometry.dispose()
        r.mesh.material.dispose()
        this.ripples.splice(i, 1)
        continue
      }
      const k = 1 - r.ttl / r.dur
      r.mesh.scale.setScalar(1 + k * 2.4)
      r.mesh.material.opacity = 0.65 * (1 - k)
    }
  }

  /**
   * 线路流光脉冲：每条线一枚亮脉冲沿管线巡航（换向折返），像能量在线路里流动。
   */
  buildLineComets() {
    const geo = new THREE.SphereGeometry(1.5, 10, 8)
    const haloGeo = new THREE.SphereGeometry(2.6, 10, 8)
    this.comets = []
    for (const line of metroLines) {
      const entry = this.lineEntries[line.lineId]
      if (!entry) continue
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false })
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(line.color),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const core = new THREE.Mesh(geo, coreMat)
      const halo = new THREE.Mesh(haloGeo, haloMat)
      core.visible = false
      halo.visible = false
      this.scene.add(core)
      this.scene.add(halo)
      this.comets.push({ lineId: line.lineId, dir: 1, s: Math.random() * entry.total, core, halo, coreMat, haloMat })
    }
  }

  _updateComets(dt) {
    if (this.reduceMotion) return
    for (const c of this.comets) {
      const entry = this.lineEntries[c.lineId]
      if (!entry) continue
      c.s += dt * 85 * c.dir
      if (c.s >= entry.total) {
        c.s = entry.total
        c.dir = -1
      } else if (c.s <= 0) {
        c.s = 0
        c.dir = 1
      }
      const { pos } = this._sample(entry.pts, entry.cum, c.s)
      c.core.position.set(pos.x, entry.liftY + 2.4, pos.z)
      c.halo.position.copy(c.core.position)
      // 聚焦态压暗时脉冲随之收敛
      const isFocus = !this.routeLineIds
        ? !this.selectedLineId || c.lineId === this.selectedLineId
        : this.routeLineIds.has(c.lineId)
      c.core.visible = true
      c.coreMat.opacity = isFocus ? 0.9 : 0.25
      c.haloMat.opacity = isFocus ? 0.4 : 0.1
    }
  }

dispose() {
    this.disposed = true
    if (this._arriveTimers) {
      Object.values(this._arriveTimers).forEach((t) => clearTimeout(t))
      this._arriveTimers = null
    }
    if (this.composer) {
      try {
        this.composer.dispose()
      } catch {
        /* 个别版本无 dispose，忽略 */
      }
      this.composer = null
    }
    if (this._winTex) {
      this._winTex.dispose()
      this._winTex = null
    }
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
