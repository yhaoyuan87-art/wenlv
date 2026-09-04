import { useEffect } from 'react'
import TopNav from './components/TopNav.jsx'
import Breadcrumb from './components/Breadcrumb.jsx'
import InfoPanel from './components/InfoPanel.jsx'
import PoiDrawer from './components/PoiDrawer.jsx'
import Legend from './components/Legend.jsx'
import CityLayer from './layers/CityLayer.jsx'
import MetroLayer from './layers/MetroLayer.jsx'
import PoiLayer from './layers/PoiLayer.jsx'
import MapLayer from './layers/MapLayer.jsx'
import { useStore, LAYERS } from './store/useStore.js'

const LAYER_VIEWS = {
  city: CityLayer,
  metro: MetroLayer,
  poi: PoiLayer,
  map2d: MapLayer
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const s = useStore.getState()
      if (e.key === 'Escape') {
        if (s.drawerPoiId) s.closeDrawer()
        else if (s.legendOpen) s.toggleLegend()
        return
      }
      const idx = parseInt(e.key, 10)
      if (idx >= 1 && idx <= LAYERS.length) s.goLayer(LAYERS[idx - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const layer = useStore((s) => s.layer)
  const View = LAYER_VIEWS[layer]
  useHotkeys()

  return (
    <div className="app">
      <TopNav />
      <Breadcrumb />
      <main className="stage">
        <div key={layer} className="layer-anim layer-host">
          <View />
        </div>
        <InfoPanel />
      </main>
      <PoiDrawer />
      <Legend />
    </div>
  )
}
