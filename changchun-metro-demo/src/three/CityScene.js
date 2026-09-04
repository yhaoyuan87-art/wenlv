import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { districts, landmarks, yitongRiver } from '../data/districts.js'

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

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export class CityScene {
  constructor(container, callbacks) {
    this.container = container
    this.callbacks = callbacks
    this.disposed = false
    this.selectedId = null
    this.hoverId = null
    this.tween = null
    this.reduceMotion = false
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2(-10, -10)
    this.districtMeshes = []
    this.districtGroups = {}
    this.labelPool = []

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0f1c)
    this.scene.fog = new THREE.Fog(0x0a0f1c, 900, 1800)

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 4000)
    this.camera.position.set(0, 560, 640)

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
    this.controls.maxPolarAngle = Math.PI / 2.15
    this.controls.minDistance = 120
    this.controls.maxDistance = 1400

    this.scene.add(new THREE.HemisphereLight(0x8fb5ff, 0x1a2340, 0.9))
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(300, 500, 200)
    this.scene.add(dir)

    this.buildGround()
    this.buildRiver()
    this.buildDistricts()
    this.buildBuildings()
    this.buildLandmarks()

    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this))
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this))
    window.addEventListener('resize', this.onResize.bind(this))

    this.animate = this.animate.bind(this)
    this.animate()
  }

  buildGround() {
    const g = new THREE.PlaneGeometry(2200, 1800)
    const m = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 1 })
    const mesh = new THREE.Mesh(g, m)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -1
    this.scene.add(mesh)

    const grid = new THREE.GridHelper(2200, 44, 0x22314f, 0x182238)
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

  districtShape(poly) {    const shape = new THREE.Shape()
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
    for (const d of districts) {
      const { X, Z } = toXZ(d.label[0], d.label[1])
      const cx = X
      const cz = Z
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
        const px = minX + Math.random() * (maxX - minX)
        const py = minY + Math.random() * (maxY - minY)
        if (!pointInPolygon(px, py, d.polygon)) continue
        const lx = px - d.label[0]
        const ly = py - d.label[1]
        if (Math.abs(lx) < 26 && Math.abs(ly) < 26) continue
        const { X: wx, Z: wz } = toXZ(px, py)
        positions.push({ x: wx, z: wz, h: 4 + Math.random() * 14, s: 4 + Math.random() * 6 })
        count++
      }
      void cx
      void cz
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
      mesh.userData = { type: 'landmark', name: lm.name, districtId: lm.districtId }
      this.scene.add(mesh)
      this.landmarkMeshes = this.landmarkMeshes || []
      this.landmarkMeshes.push(mesh)

      const labelDiv = document.createElement('div')
      labelDiv.className = 'landmark-label'
      labelDiv.textContent = lm.name
      const labelObj = new CSS2DObject(labelDiv)
      labelObj.position.set(X, lm.h + 8, Z)
      this.scene.add(labelObj)
    }
  }

  onPointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const targets = [...this.districtMeshes, ...(this.landmarkMeshes || [])]
    const hits = this.raycaster.intersectObjects(targets, false)
    return hits.length ? hits[0].object : null
  }

  onClick() {
    const hit = this.pick()
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
    this.flyTo(new THREE.Vector3(0, 560, 640), new THREE.Vector3(0, 0, 0))
  }

  topView() {
    this.flyTo(new THREE.Vector3(0, 1000, 4), new THREE.Vector3(0, 0, 0))
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
