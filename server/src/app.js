import express from 'express'

const app = express()

app.disable('x-powered-by')

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

export default app