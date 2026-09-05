import { useState } from 'react'

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function PlaceholderMedia({ seed, title, sub, ratio = '16/9', variant = 0, media = null }) {
  const [broken, setBroken] = useState(false)
  const ready = media && media.status === 'ready' && media.cover && !broken

  if (ready) {
    return (
      <div className="ph-media" style={{ aspectRatio: ratio }}>
        <img src={media.cover} alt={title || ''} className="ph-img" onError={() => setBroken(true)} />
        <div className="ph-text">
          <b>{title}</b>
          {sub && <span>{sub}</span>}
        </div>
      </div>
    )
  }

  const h = hashCode(String(seed)) % 360
  const h2 = (h + 50) % 360
  const angle = 120 + (hashCode(String(seed) + 'a') % 60)
  const bg = `linear-gradient(${angle}deg, hsl(${h}, 55%, 32%), hsl(${h2}, 60%, 16%))`
  return (
    <div className="ph-media" style={{ background: bg, aspectRatio: ratio }} title={media?.cover ? `待接入：${media.cover}` : undefined}>
      <svg viewBox="0 0 120 80" className="ph-art" aria-hidden="true">
        <circle cx="95" cy="18" r="10" fill={`hsla(${h2}, 70%, 70%, 0.5)`} />
        <path d={`M0 62 L22 38 L40 54 L58 30 L78 50 L96 40 L120 58 L120 80 L0 80 Z`} fill={`hsla(${h}, 45%, 55%, 0.35)`} />
        <path d={`M0 70 L18 52 L34 64 L52 46 L72 62 L92 52 L120 66 L120 80 L0 80 Z`} fill={`hsla(${h2}, 40%, 40%, 0.5)`} />
      </svg>
      <div className="ph-text">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
      {variant === 1 && (
        <div className="ph-badge">
          <span className="ph-play" />
          视频位
        </div>
      )}
      {variant === 2 && <div className="ph-badge">360° 位</div>}
    </div>
  )
}
