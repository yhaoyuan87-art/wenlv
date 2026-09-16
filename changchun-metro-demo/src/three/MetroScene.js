import * as THREE from 'three'
import CameraControls from 'camera-controls'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { districts } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { poisByStation } from '../data/pois.js'
import { toXZ } from './CityScene.js'
import { pixelRatio, fitCamera, portraitPull, observeSize, isMobile } from './adapt.js'
import { cssVar, hexToNumber } from '../theme/theme.js'

CameraControls.install({ THREE })

const UP_Y = new THREE.Vector3(0, 1, 0)
const PLUS_Z = new THREE.Vector3(0, 0, 1)
/** 三节编组的车厢中心间距（弧长偏移，含 0.5 车厢间隙） */
const CAR_SPACING = 5.6

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

    for (const d of districts) {
      const shape = new THREE.Shape()
      d.polygon.forEach(([x, y], i) => {
        const { X, Z } = toXZ(x, y)
        if (i === 0) shape.moveTo(X, Z)
        else shape.lineTo(X, Z)
      })
      const geo = new THREE.ShapeGeometry(shape)
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color),
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = -1.9
      mesh.userData = { type: 'district', id: d.districtId }
      this.scene.add(mesh)
      this.groundMats.push({ mesh, mat, id: d.districtId })

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
    bodyGeo.rotateX(Math.PI / 2) // 车体轴向转到 +Z，与行进切线对齐
    const winGeo = new THREE.BoxGeometry(2.72, 0.62, CAR.len + 0.4) // 比车体直径略宽，侧面露出灯带
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
      const windowMat = new THREE.MeshBasicMaterial({ color: 0xd9edff, transparent: true, opacity: 0.92 })
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
          cruise: 34,
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

  onPointerDown(e) {
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
    if (!hit) return
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
   * 统一明暗：路径规划激活时只保留途经线路，否则按当前选中线路聚焦。
   * 管线 / 站点 / 列车 / 车头灯同源明暗，避免「线亮车暗」的割裂感。
   */
  _applyFocus() {
    for (const lid in this.lineEntries) {
      const entry = this.lineEntries[lid]
      const isFocus = this.routeLineIds
        ? this.routeLineIds.has(lid)
        : !this.selectedLineId || lid === this.selectedLineId
      entry.tubeMat.opacity = isFocus ? 0.96 : 0.1
      entry.tubeMat.emissiveIntensity = isFocus ? 1 : 0.2
      entry.stationMeshes.forEach((m) => {
        m.material.opacity = isFocus ? 1 : 0.12
      })
      // 列车五件套同源明暗：车身 / 车窗 / 光晕 / 头灯 / 尾灯
      if (entry.trainMat) entry.trainMat.opacity = isFocus ? 1 : 0.16
      if (entry.windowMat) entry.windowMat.opacity = isFocus ? 0.92 : 0.08
      if (entry.glowMat) entry.glowMat.opacity = isFocus ? 0.22 : 0.03
      if (entry.headMat) entry.headMat.opacity = isFocus ? 1 : 0.15
      if (entry.tailMat) entry.tailMat.opacity = isFocus ? 1 : 0.15
    }
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
    let total = 0
    for (const seg of route.segments) {
      const entry = this.lineEntries[seg.lineId]
      if (!entry) continue
      const pts = seg.stationIds
        .filter((sid) => sid in entry.stationIndexById)
        .map((sid) => entry.pts[entry.stationIndexById[sid]].clone().setY(entry.liftY + 0.5))
      if (pts.length < 2) continue
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(seg.color),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      this._tubeAlong(group, pts, 2.6, glowMat)
      const cum = [0]
      for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
      segs.push({ pts, cum, color: seg.color, base: total, len: cum[cum.length - 1] })
      total += cum[cum.length - 1]
    }
    if (!segs.length || total <= 0) {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
      return
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

    this.route = { group, inst, states, segs, total, rings, flags, pulseMeshes }
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

  /** 沿折线铺发光管：开式圆柱端点严格落在站点上，与主线路同构 */
  _tubeAlong(parent, pts, radius, mat) {
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
    }
  }

  /** 按全程偏移量定位所在乘车段（segs 按 base 升序） */
  _findSeg(segs, off) {
    for (let i = segs.length - 1; i >= 0; i -= 1) {
      if (off >= segs[i].base) return i
    }
    return 0
  }

  _updateRoute(dt) {
    const r = this.route
    if (!r) return
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
      for (const s of line.stations) {
        const el = this.stationLabels[s.stationId]
        const obj = this.stationLabelObjs[s.stationId]
        if (!el || !obj) continue
        const hasPoi = poisByStation(s.stationId).length > 0
        const isTransfer = (s.transfer || []).length > 0
        const isSel = s.stationId === stationId
        let show = isSel || (isFocus && (isTransfer || hasPoi))
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
        prio: c.prio,
        w: c.w,
        h: c.h,
        obj,
        sx: (v.x * 0.5 + 0.5) * w,
        sy: (-v.y * 0.5 + 0.5) * h
      })
    }
    cands.sort((a, b) => b.prio - a.prio)
    const placed = []
    for (const c of cands) {
      const box = { x1: c.sx - c.w / 2, x2: c.sx + c.w / 2, y1: c.sy - c.h, y2: c.sy }
      const collides = placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)
      c.obj.visible = !collides
      if (!collides) placed.push(box)
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

  /** 主题切换：同步场景背景、雾、网格与灯光反射色 */
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
    this._updateTrains(delta)
    this._updateFollow(delta)
    this._updatePulses(delta)
    this._updateRoute(delta)
    this.cullLabels()
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    if (this._arriveTimers) {
      Object.values(this._arriveTimers).forEach((t) => clearTimeout(t))
      this._arriveTimers = null
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
