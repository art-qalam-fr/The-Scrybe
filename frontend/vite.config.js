import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Banniere d'identite : un scanner de ports (Cerber Security Shield) qui
// sonde :5173 recoit 'X-Scrybe: The-Scrybe/vite' + /api/identity JSON,
// au lieu d'un dev server anonyme.
const scrybeIdentity = {
  name: 'scrybe-identity',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      res.setHeader('X-Scrybe', 'The-Scrybe/vite')
      if (req.url === '/api/identity') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          app: 'The Scrybe',
          component: 'vite-dev-server',
          banner: 'The-Scrybe/vite',
          port: 5173,
          pid: process.pid,
          exe: process.execPath.split(/[\\/]/).pop(),
        }))
        return
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), scrybeIdentity],
  server: {
    open: false,
    port: 5173,
    strictPort: true,
  },
  base: './',
})
