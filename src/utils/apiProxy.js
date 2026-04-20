/**
 * 将外部 API URL 转换为 CORS 代理 URL
 * - 开发环境：走 Vite 中间件 /cors-proxy/{url}
 * - 生产环境：走 Vercel Edge Function /api/cors-proxy?url={encoded_url}
 */
export function proxiedUrl(url) {
  if (!url || !url.startsWith('http')) return url

  if (import.meta.env.DEV) {
    return `/cors-proxy/${url}`
  }
  return `/api/cors-proxy?url=${encodeURIComponent(url)}`
}
