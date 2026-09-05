import { useEffect, useState } from 'react'

/** 订阅一条 CSS media query，返回当前是否匹配（SSR / 老浏览器安全） */
export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatch(e.matches)
    // 初始值已在 useState 初始化时用 mq.matches 计算好，这里只负责监听变化
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [query])

  return match
}

/** 手机布局断点，与 index.css 的 @media (max-width: 720px) 保持一致 */
export const MOBILE_QUERY = '(max-width: 720px)'

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY)
