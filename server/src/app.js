import cookieParser from 'cookie-parser'
import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requestId } from './middleware/requestId.js'
import { requestLogger } from './middleware/requestLogger.js'
import authRoutes from './modules/auth/authRoutes.js'
import memoryRoutes from './modules/memories/memoryRoutes.js'

const app = express()

app.disable('x-powered-by')

app.use(requestId)
app.use(requestLogger)
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

app.use('/api/auth', authRoutes)
app.use('/api/memories', memoryRoutes)

app.use(notFound)
app.use(errorHandler)

export default app