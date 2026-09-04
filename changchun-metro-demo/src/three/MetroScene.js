import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { districts } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { poisByStation } from '../data/pois.js'
import { toXZ } from './CityScene.js'

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export class MetroScene {
  constructor(container, callbacks) {
    this.container = container
    this.callbacks = callbacks
    this.disposed = false
    this.selectedLineId = null
    this.selectedStationId = null
    this.tween = null
    this.reduceMotion = false
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2(-10, -10)
    this.lineEntries = {}
    this.stationMeshes = []
    this.stationLabels = {}
    this.stationLabelObjs = {}
    this.groundMats = []

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x070c17)
    this.scene.fog = new THREE.Fog(0x070c17, 800, 1900)

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 4000)
    this.camera.position.set(-80, 420, 560)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight)
    this.labelRenderer.domElement.style.position = 'absolute'
    this.labelRenderer.domElement.style.top = '0'
    this.labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.labelRenderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2.1
    this.controls.minDistance = 60
    this.controls.maxDistance = 1400

    this.scene.add(new THREE.HemisphereLight(0x8fb5ff, 0x141c30, 0.85))
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(200, 400, 100)
    this.scene.add(dir)

    this.buildGround()
    this.buildLines()
    this.updateLabels(null, null)

    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this))
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this))
    window.addEventListener('resize', this.onResize.bind(this))
    this.animate = this.animate.bind(this)
    this.animate()
  }

  buildGround() {
    const grid = new THREE.GridHelper(2200, 44, 0x1b2a47, 0x121d33)
    grid.position.y = -2
    this.scene.add(grid)

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
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.08)
      const tubeGeo = new THREE.TubeGeometry(curve, pts.length * 6, 1.1, 8, false)
      const tubeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(line.color),
        emissive: new THREE.Color(line.color).multiplyScalar(0.45),
        roughness: 0.35,
        metalness: 0.2,
        transparent: true,
        opacity: 0.96
      })
      const tube = new THREE.Mesh(tubeGeo, tubeMat)
      tube.userData = { type: 'line', lineId: line.lineId }
      group.add(tube)

      const stationMeshes = []
      for (const s of line.stations) {
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
      }

      this.scene.add(group)
      this.lineEntries[line.lineId] = { group, tubeMat, stationMeshes, liftY }
    })
  }

  onPointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const targets = [...this.stationMeshes]
    for (const lid in this.lineEntries) targets.push(this.lineEntries[lid].tubeMat ? this.lineEntries[lid].group.children[0] : null)
    const hits = this.raycaster.intersectObjects(targets.filter(Boolean), false)
    return hits.length ? hits[0].object : null
  }

  onClick() {
    const hit = this.pick()
    if (!hit) return
    if (hit.userData.type === 'station') this.callbacks.onSelectStation(hit.userData.stationId)
    else if (hit.userData.type === 'line') this.callbacks.onSelectLine(hit.userData.lineId)
  }

  highlightLine(lineId, stationId) {
    this.selectedLineId = lineId
    this.selectedStationId = stationId
    for (const lid in this.lineEntries) {
      const entry = this.lineEntries[lid]
      const isFocus = !lineId || lid === lineId
      entry.tubeMat.opacity = isFocus ? 0.96 : 0.14
      entry.tubeMat.emissiveIntensity = isFocus ? 1 : 0.25
      entry.stationMeshes.forEach((m) => {
        const isThis = m.userData.lineId === lid
        const isSel = stationId && m.userData.stationId === stationId
        m.material.opacity = isFocus ? 1 : 0.15
        if (isSel) {
          m.material.color.set(0xffffff)
          m.material.emissive.set(0x38e1ff)
          m.scale.set(1.35, 1.9, 1.35)
        } else if (isThis) {
          m.scale.set(1, 1, 1)
        }
      })
      this.updateLabels(lineId, stationId)
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
        obj.visible = show
        el.classList.toggle('selected', isSel)
      }
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
    this.flyTo(new THREE.Vector3(-80, 420, 560), new THREE.Vector3(0, 0, 0))
  }

  topView() {
    this.flyTo(new THREE.Vector3(0, 980, 4), new THREE.Vector3(0, 0, 0))
  }

  flyTo(pos, look) {
    if (this.reduceMotion) {
      this.camera.position.copy(pos)
      this.controls.target.copy(look)
      return
    }
    this.tween = {
      t0: performance.now(),
      duration: 700,
      fromPos: this.camera.position.clone(),
      toPos: pos.clone(),
      fromLook: this.controls.target.clone(),
      toLook: look.clone()
    }
  }

  setReduceMotion(v) {
    this.reduceMotion = v
    this.controls.enableDamping = !v
  }

  onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  animate() {
    if (this.disposed) return
    requestAnimationFrame(this.animate)
    if (this.tween) {
      const t = Math.min(1, (performance.now() - this.tween.t0) / this.tween.duration)
      const k = easeInOutCubic(t)
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, k)
      this.controls.target.lerpVectors(this.tween.fromLook, this.tween.toLook, k)
      if (t >= 1) this.tween = null
    }
    this.controls.update()
    const hit = this.pick()
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.controls.dispose()
    this.renderer.dispose()
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        Array.isArray(obj.material) ? obj.material.forEach((m) => m.dispose()) : obj.material.dispose()
      }
    })
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
    window.removeEventListener('resize', this.onResize)
  }
}
