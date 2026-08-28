import cookieParser from 'cookie-parser'
import express from 'express'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requestId } from './middleware/requestId.js'
import { requestLogger } from './middleware/requestLogger.js'
import { securityHeaders } from './middleware/securityHeaders.js'
import adminRoutes from './modules/admin/adminRoutes.js'
import authRoutes from './modules/auth/authRoutes.js'
import chatRoutes from './modules/chat/chatRoutes.js'
import biographyRoutes from './modules/memories/biographyRoutes.js'
import familyAccessRoutes from './modules/memories/familyAccessRoutes.js'
import familyQuestionRoutes from './modules/memories/familyQuestionRoutes.js'
import memoryRoutes from './modules/memories/memoryRoutes.js'
import memoryAssetRoutes from './modules/media/memoryAssetRoutes.js'
import recordingRoutes from './modules/media/recordingRoutes.js'
import pricingPilotRoutes from './modules/pricingPilot/pricingPilotRoutes.js'
import {
  isPersistentStorageReady,
} from './platform/storage/persistentStorageReadiness.js'

const app = express()
const clientBuildDirectory =
  fileURLToPath(
    new URL('../../client/dist', import.meta.url),
  )
const clientIndexPath = path.join(
  clientBuildDirectory,
  'index.html',
)

app.disable('x-powered-by')

if (env.trustProxyHops > 0) {
  app.set('trust proxy', env.trustProxyHops)
}

app.use(requestId)
app.use(requestLogger)
app.use(securityHeaders)
app.use(cookieParser())
app.use(
  express.json({
    limit: '100kb',
  }),
)

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'living-memory-api',
      timestamp: new Date().toISOString(),
    },
  })
})

app.get('/api/ready', async (_req, res) => {
  const databaseReady =
    mongoose.connection.readyState === 1
  const storageReady =
    await isPersistentStorageReady()
  const ready =
    databaseReady && storageReady

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      database: databaseReady
        ? 'ready'
        : 'not_ready',
      storage: storageReady
        ? 'ready'
        : 'not_ready',
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/family-access', familyAccessRoutes)

app.use(
  '/api/memories/:memoryId/biography',
  biographyRoutes,
)

app.use(
  '/api/memories/:memoryId/chat',
  chatRoutes,
)

app.use(
  '/api/memories/:memoryId/family-questions',
  familyQuestionRoutes,
)

app.use(
  '/api/memories/:memoryId/recordings',
  recordingRoutes,
)

app.use(
  '/api/memories/:memoryId/assets',
  memoryAssetRoutes,
)

app.use(
  '/api/memories/:memoryId/pricing-pilot',
  pricingPilotRoutes,
)

app.use('/api/memories', memoryRoutes)

if (env.serveClientBuild) {
  app.use(
    express.static(clientBuildDirectory, {
      index: false,
      maxAge: env.nodeEnv === 'production'
        ? '1h'
        : 0,
    }),
  )

  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api/') ||
      !req.accepts('html')
    ) {
      next()
      return
    }

    res.sendFile(clientIndexPath, (error) => {
      if (error) {
        next(error)
      }
    })
  })
}

app.use(notFound)
app.use(errorHandler)

export default app
