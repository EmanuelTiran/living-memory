import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    MemoryBiographyAnswer: {
      find: vi.fn(),
    },
  }))

  vi.mock(
    '../src/modules/memories/MemoryBiographyAnswer.js',
    () => ({
      default:
        mocks.MemoryBiographyAnswer,
    }),
  )

  import {
    APPROVED_BIOGRAPHY_CANDIDATE_LIMIT,
    approvedBiographySourceProvider,
    listApprovedBiographySources,
  } from '../src/modules/chat/approvedBiographySourceProvider.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const biographyAnswerId =
    '507f1f77bcf86cd799439011'

  const approvedAt =
    new Date(
      '2026-07-28T11:00:00.000Z',
    )

  function createQuery(result) {
    const query = {
      sort: vi.fn(),
      limit: vi.fn(),
      select: vi.fn(),
      lean: vi.fn(),
    }

    query.sort.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.lean.mockResolvedValue(result)

    return query
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe(
    'Approved biography source provider',
    () => {
      it('returns approved biography answers as generic sources', async () => {
        const query = createQuery([
          {
            _id: biographyAnswerId,
            question:
              'What was her favorite color?',
            answer:
              'She preferred blue.',
            approvedAt,
            revision: 2,
            updatedAt:
              new Date(
                '2026-07-28T12:00:00.000Z',
              ),
          },
        ])

        mocks.MemoryBiographyAnswer.find
          .mockReturnValue(query)

        const result =
          await listApprovedBiographySources(
            memoryId,
          )

        expect(
          mocks.MemoryBiographyAnswer.find,
        ).toHaveBeenCalledWith({
          memoryId,
          status: 'approved',
        })

        expect(query.sort)
          .toHaveBeenCalledWith({
            updatedAt: -1,
          })

        expect(query.limit)
          .toHaveBeenCalledWith(
            APPROVED_BIOGRAPHY_CANDIDATE_LIMIT,
          )

        expect(query.select)
          .toHaveBeenCalledWith({
            _id: 1,
            question: 1,
            answer: 1,
            approvedAt: 1,
            revision: 1,
            updatedAt: 1,
          })

        expect(result).toEqual([
          {
            sourceType:
              'biography_answer',
            sourceId:
              biographyAnswerId,
            title:
              'What was her favorite color?',
            content:
              'She preferred blue.',
            approvedAt,
            sourceVersion:
              'revision:2',
            sourceRoute:
              `/app/memories/${memoryId}#guided-interview`,
          },
        ])
      })

      it('does not query draft answers', async () => {
        const query = createQuery([])

        mocks.MemoryBiographyAnswer.find
          .mockReturnValue(query)

        const result =
          await listApprovedBiographySources(
            memoryId,
          )

        expect(
          mocks.MemoryBiographyAnswer.find,
        ).toHaveBeenCalledWith({
          memoryId,
          status: 'approved',
        })

        expect(result).toEqual([])
      })

      it('bounds the candidate limit', async () => {
        const highLimitQuery =
          createQuery([])

        const lowLimitQuery =
          createQuery([])

        mocks.MemoryBiographyAnswer.find
          .mockReturnValueOnce(
            highLimitQuery,
          )
          .mockReturnValueOnce(
            lowLimitQuery,
          )

        await listApprovedBiographySources(
          memoryId,
          {
            limit: 500,
          },
        )

        await listApprovedBiographySources(
          memoryId,
          {
            limit: 0,
          },
        )

        expect(
          highLimitQuery.limit,
        ).toHaveBeenCalledWith(
          APPROVED_BIOGRAPHY_CANDIDATE_LIMIT,
        )

        expect(
          lowLimitQuery.limit,
        ).toHaveBeenCalledWith(1)
      })

      it('exposes the generic provider interface', () => {
        expect(
          approvedBiographySourceProvider,
        ).toMatchObject({
          sourceType:
            'biography_answer',
          listApprovedSources:
            listApprovedBiographySources,
        })

        expect(
          Object.isFrozen(
            approvedBiographySourceProvider,
          ),
        ).toBe(true)
      })
    },
  )
