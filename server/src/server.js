import app from './app.js'
import {
  connectToDatabase,
  disconnectFromDatabase,
} from './config/database.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

let httpServer
let isShuttingDown = false

function startHttpServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(env.port, () => {
      server.off('error', reject)
      resolve(server)
    })

    server.once('error', reject)
  })
}

async function startServer() {
  await connectToDatabase()
  httpServer = await startHttpServer()

  logger.info('Living Memory API started', {
    port: env.port,
    environment: env.nodeEnv,
  })
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true

  logger.info('Shutdown signal received', {
    signal,
  })

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })

      logger.info('HTTP server closed')
    }

    await disconnectFromDatabase()
    process.exit(0)
  } catch (error) {
    logger.error('Graceful shutdown failed', {
      errorName: error.name,
      errorCode: error.code ?? null,
    })

    process.exit(1)
  }
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

startServer().catch(async (error) => {
  logger.error('Living Memory API startup failed', {
    errorName: error.name,
    errorCode: error.code ?? null,
  })

  await disconnectFromDatabase().catch(() => {})
  process.exit(1)
})