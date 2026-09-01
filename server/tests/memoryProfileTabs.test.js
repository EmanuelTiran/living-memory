import { describe, expect, it } from 'vitest'
import {
  createMemoryProfileTabSearch,
  getMemoryProfileCapabilities,
  getRtlTabTargetIndex,
  getVisibleMemoryProfileTabs,
  resolveMemoryProfileTab,
} from '../../client/src/features/memories/memoryProfileTabs.js'

describe('memory profile tab navigation', () => {
  it.each([
    ['viewer', false, false, false],
    ['contributor', true, false, false],
    ['editor', true, true, false],
    ['steward', true, true, true],
    ['owner', true, true, true],
  ])(
    'maps the %s role to the server capability boundary',
    (
      role,
      canContribute,
      canEdit,
      canManage,
    ) => {
      expect(
        getMemoryProfileCapabilities(role),
      ).toEqual({
        canContribute,
        canEdit,
        canManage,
      })
    },
  )

  it('shows all four tabs to a contributor', () => {
    expect(
      getVisibleMemoryProfileTabs('contributor')
        .map((tab) => tab.id),
    ).toEqual([
      'today',
      'documentation',
      'archive',
      'family',
    ])
  })

  it('removes documentation entirely for a viewer', () => {
    expect(
      getVisibleMemoryProfileTabs('viewer')
        .map((tab) => tab.id),
    ).toEqual([
      'today',
      'archive',
      'family',
    ])
  })

  it('redirects a viewer away from a saved documentation link', () => {
    expect(
      resolveMemoryProfileTab(
        'documentation',
        'viewer',
      ),
    ).toEqual({
      activeTab: 'today',
      notice:
        'התיעוד אינו זמין בהרשאת צפייה; הועברתם לעמוד היום.',
      shouldReplaceUrl: true,
    })
  })

  it('canonicalizes missing and unknown tabs to today', () => {
    expect(
      resolveMemoryProfileTab(null, 'owner'),
    ).toMatchObject({
      activeTab: 'today',
      shouldReplaceUrl: true,
    })

    expect(
      resolveMemoryProfileTab(
        'unknown',
        'owner',
      ),
    ).toMatchObject({
      activeTab: 'today',
      shouldReplaceUrl: true,
    })
  })

  it('keeps unrelated query parameters when changing tabs', () => {
    expect(
      createMemoryProfileTabSearch(
        '?source=pilot&tab=today',
        'archive',
      ),
    ).toBe('?source=pilot&tab=archive')
  })

  it.each([
    ['ArrowLeft', 1, 2],
    ['ArrowRight', 1, 0],
    ['Home', 3, 0],
    ['End', 0, 3],
    ['ArrowRight', 0, 3],
  ])(
    'moves RTL tab focus for %s',
    (key, currentIndex, expectedIndex) => {
      expect(
        getRtlTabTargetIndex(
          key,
          currentIndex,
          4,
        ),
      ).toBe(expectedIndex)
    },
  )

  it('ignores unrelated tab keys', () => {
    expect(
      getRtlTabTargetIndex(
        'Enter',
        0,
        4,
      ),
    ).toBe(-1)
  })
})
