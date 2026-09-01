import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  getDocumentationToolHash,
  getVisibleDocumentationTools,
  MEMORY_DOCUMENTATION_TOOL_IDS,
  resolveDocumentationTool,
} from '../../client/src/features/memories/memoryDocumentationTools.js'

describe('memory documentation tools', () => {
  it('offers all three documentation choices to a managing role', () => {
    expect(
      getVisibleDocumentationTools(true)
        .map((tool) => tool.id),
    ).toEqual([
      'conversation',
      'story',
      'topics',
    ])
  })

  it('offers only story writing without manage permission', () => {
    expect(
      getVisibleDocumentationTools(false)
        .map((tool) => tool.id),
    ).toEqual(['story'])
  })

  it.each([
    ['#guided-interview', 'conversation'],
    ['#stories-title', 'story'],
    ['#biography-topic-picker', 'topics'],
  ])(
    'restores %s as the %s tool',
    (hash, expectedTool) => {
      expect(
        resolveDocumentationTool({
          canManage: true,
          hash,
        }),
      ).toBe(expectedTool)
    },
  )

  it('opens conversation when a guided interview was requested externally', () => {
    expect(
      resolveDocumentationTool({
        canManage: true,
        hash: '',
        startGuidedInterview: true,
      }),
    ).toBe(
      MEMORY_DOCUMENTATION_TOOL_IDS.conversation,
    )
  })

  it('falls back safely to story writing for a non-managing role', () => {
    expect(
      resolveDocumentationTool({
        canManage: false,
        hash: '#guided-interview',
      }),
    ).toBe(
      MEMORY_DOCUMENTATION_TOOL_IDS.story,
    )
  })

  it('keeps an unknown manager link at the choice screen', () => {
    expect(
      resolveDocumentationTool({
        canManage: true,
        hash: '#unknown',
      }),
    ).toBe('')
  })

  it('provides stable hashes for direct tool links', () => {
    expect(
      getDocumentationToolHash(
        MEMORY_DOCUMENTATION_TOOL_IDS.topics,
      ),
    ).toBe('#biography-topic-picker')
  })
})
