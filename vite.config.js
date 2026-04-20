import { fileURLToPath, URL } from 'node:url'
import http from 'node:http'
import https from 'node:https'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * Vite 插件：本地 CORS 代理
 * 将 /cors-proxy/https://xxx 的请求转发到目标服务器，绕过浏览器跨域限制
 */
function corsProxyPlugin() {
  return {
    name: 'vite-plugin-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/cors-proxy', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          })
          return res.end()
        }

        const targetUrl = req.url.slice(1)
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          return next()
        }

        let parsed
        try {
          parsed = new URL(targetUrl)
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Invalid target URL' }))
        }

        const client = parsed.protocol === 'https:' ? https : http

        const skipHeaders = new Set([
          'host', 'origin', 'referer', 'connection',
          'accept-encoding',
          'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
          'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
        ])
        const forwardHeaders = {}
        for (const [key, value] of Object.entries(req.headers)) {
          if (!skipHeaders.has(key)) {
            forwardHeaders[key] = value
          }
        }
        forwardHeaders.host = parsed.host

        const proxyReq = client.request(
          targetUrl,
          { method: req.method, headers: forwardHeaders },
          (proxyRes) => {
            const headers = { ...proxyRes.headers }
            headers['access-control-allow-origin'] = '*'
            headers['access-control-allow-headers'] = '*'
            delete headers['content-encoding']
            delete headers['content-length']

            res.writeHead(proxyRes.statusCode, headers)
            proxyRes.pipe(res)
          }
        )

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
          }
          res.end(JSON.stringify({ error: err.message }))
        })

        req.pipe(proxyReq)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    corsProxyPlugin(),
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
