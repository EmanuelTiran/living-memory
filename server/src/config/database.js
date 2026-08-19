import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../utils/logger.js'
import {
  prepareMongoDBSrvDns,
} from './mongodbDnsResolver.js'

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  const dnsPreparation =
    await prepareMongoDBSrvDns(
      env.mongodbUri,
    )

  if (dnsPreparation.fallbackApplied) {
    logger.warn(
      'MongoDB SRV DNS fallback activated',
    )
  }

  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
  })

  logger.info('MongoDB connected', {
    database: mongoose.connection.name,
  })

  return mongoose.connection
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState === 0) {
    return
  }

  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}
