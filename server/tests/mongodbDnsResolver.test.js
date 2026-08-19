import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  MONGODB_DNS_FALLBACK_SERVERS,
  prepareMongoDBSrvDns,
} from '../src/config/mongodbDnsResolver.js'

const mongodbSrvUri =
  'mongodb+srv://user:password@cluster.example.mongodb.net/living_memory'

describe('MongoDB SRV DNS resolver', () => {
  it('does not query DNS for a standard MongoDB connection string', async () => {
    const resolveSrvRecord = vi.fn()

    const result =
      await prepareMongoDBSrvDns(
        'mongodb://127.0.0.1:27017/living_memory',
        {
          resolveSrvRecord,
        },
      )

    expect(result).toEqual({
      fallbackApplied: false,
    })
    expect(resolveSrvRecord)
      .not.toHaveBeenCalled()
  })

  it('keeps the system DNS when the SRV query succeeds', async () => {
    const resolveSrvRecord = vi
      .fn()
      .mockResolvedValue([])
    const writeDnsServers = vi.fn()

    const result =
      await prepareMongoDBSrvDns(
        mongodbSrvUri,
        {
          resolveSrvRecord,
          writeDnsServers,
        },
      )

    expect(result).toEqual({
      fallbackApplied: false,
    })
    expect(resolveSrvRecord)
      .toHaveBeenCalledWith(
        '_mongodb._tcp.cluster.example.mongodb.net',
      )
    expect(writeDnsServers)
      .not.toHaveBeenCalled()
  })

  it('uses public fallback DNS only after ECONNREFUSED', async () => {
    const refusedError = Object.assign(
      new Error('DNS refused'),
      {
        code: 'ECONNREFUSED',
      },
    )
    const resolveSrvRecord = vi
      .fn()
      .mockRejectedValueOnce(refusedError)
    const writeDnsServers = vi.fn()

    const result =
      await prepareMongoDBSrvDns(
        mongodbSrvUri,
        {
          resolveSrvRecord,
          writeDnsServers,
        },
      )

    expect(result).toEqual({
      fallbackApplied: true,
    })
    expect(writeDnsServers)
      .toHaveBeenCalledTimes(1)
    expect(writeDnsServers)
      .toHaveBeenCalledWith([
        ...MONGODB_DNS_FALLBACK_SERVERS,
      ])
    expect(resolveSrvRecord)
      .toHaveBeenCalledTimes(1)
  })

  it('does not perform another preflight query after activating the fallback', async () => {
    const refusedError = Object.assign(
      new Error('DNS refused'),
      {
        code: 'ECONNREFUSED',
      },
    )
    const resolveSrvRecord = vi
      .fn()
      .mockRejectedValueOnce(refusedError)
    const writeDnsServers = vi.fn()

    const result =
      await prepareMongoDBSrvDns(
        mongodbSrvUri,
        {
          resolveSrvRecord,
          writeDnsServers,
        },
      )

    expect(result).toEqual({
      fallbackApplied: true,
    })
    expect(resolveSrvRecord)
      .toHaveBeenCalledTimes(1)
    expect(writeDnsServers)
      .toHaveBeenCalledTimes(1)
  })
})
