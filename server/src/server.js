import app from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.port, () => {
  console.log(`Living Memory API is listening on port ${env.port}`)
})

const shutdown = (signal) => {
  console.log(`${signal} received. Closing HTTP server.`)

  server.close(() => {
    console.log('HTTP server closed.')
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
