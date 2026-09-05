import mediaData from './media.json'

const { baseUrl, entries } = mediaData

// 按约定路径生成缺省媒体结构，media.json 中的条目可逐字段覆盖
export function getMedia(poiId) {
  const entry = entries[poiId] || {}
  const base = `${baseUrl}/${poiId}`
  return {
    status: entry.status || 'placeholder',
    cover: entry.cover || `${base}/cover.jpg`,
    video: entry.video || `${base}/intro.mp4`,
    panorama: entry.panorama || `${base}/panorama.jpg`,
    gallery: entry.gallery || [`${base}/gallery-1.jpg`, `${base}/gallery-2.jpg`, `${base}/gallery-3.jpg`]
  }
}
