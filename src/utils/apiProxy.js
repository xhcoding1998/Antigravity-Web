/**
 * 开发环境下，将外部 API URL 转换为本地 CORS 代理 URL
 * 生产环境直接返回原始 URL（需自行通过 Nginx 等处理跨域）
 */
export function proxiedUrl(url) {
  if (import.meta.env.DEV && url.startsWith('http')) {
    return `/cors-proxy/${url}`
  }
  return url
}
