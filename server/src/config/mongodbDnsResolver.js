import {
  setServers,
} from 'node:dns'
import {
  Resolver,
} from 'node:dns/promises'

export const MONGODB_DNS_FALLBACK_SERVERS =
  Object.freeze([
    '1.1.1.1',
    '8.8.8.8',
  ])

function getMongoSrvQuery(mongodbUri) {
  if (
    typeof mongodbUri !== 'string' ||
    !mongodbUri.startsWith(
      'mongodb+srv://',
    )
  ) {
    return null
  }

  const authority = mongodbUri
    .slice('mongodb+srv://'.length)
    .split('/')[0]
  const hostname = authority
    .slice(authority.lastIndexOf('@') + 1)
    .trim()

  if (!hostname) {
    throw new TypeError(
      'MongoDB SRV hostname is unavailable.',
    )
  }

  return `_mongodb._tcp.${hostname}`
}

async function resolveSrvWithSystemDns(
  srvQuery,
) {
  const resolver = new Resolver()

  return resolver.resolveSrv(srvQuery)
}

export async function prepareMongoDBSrvDns(
  mongodbUri,
  {
    resolveSrvRecord =
      resolveSrvWithSystemDns,
    writeDnsServers = setServers,
    fallbackServers =
      MONGODB_DNS_FALLBACK_SERVERS,
  } = {},
) {
  const srvQuery =
    getMongoSrvQuery(mongodbUri)

  if (!srvQuery) {
    return {
      fallbackApplied: false,
    }
  }

  try {
    await resolveSrvRecord(srvQuery)

    return {
      fallbackApplied: false,
    }
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED') {
      throw error
    }
  }

  writeDnsServers([...fallbackServers])

  return {
    fallbackApplied: true,
  }
}
