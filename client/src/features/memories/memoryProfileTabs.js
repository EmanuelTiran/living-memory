export const MEMORY_PROFILE_TAB_IDS = {
  today: 'today',
  documentation: 'documentation',
  archive: 'archive',
  family: 'family',
}

export const MEMORY_PROFILE_TABS = [
  {
    id: MEMORY_PROFILE_TAB_IDS.today,
    label: 'היום',
    tooltip: 'מה כדאי לעשות עכשיו בזיכרון',
  },
  {
    id: MEMORY_PROFILE_TAB_IDS.documentation,
    label: 'תיעוד',
    tooltip: 'להוסיף ראיון, סיפור או זיכרון',
  },
  {
    id: MEMORY_PROFILE_TAB_IDS.archive,
    label: 'הארכיון',
    tooltip: 'כל הסיפורים והמקורות שנשמרו',
  },
  {
    id: MEMORY_PROFILE_TAB_IDS.family,
    label: 'שאלות ומשפחה',
    tooltip: 'לשאול על הזיכרון ולשתף את המשפחה',
  },
]

const EDIT_ROLES = new Set([
  'owner',
  'editor',
  'steward',
])

const MANAGE_ROLES = new Set([
  'owner',
  'steward',
])

export function getMemoryProfileCapabilities(
  authorizationRole,
) {
  return {
    canContribute:
      authorizationRole !== 'viewer',
    canEdit:
      EDIT_ROLES.has(authorizationRole),
    canManage:
      MANAGE_ROLES.has(authorizationRole),
  }
}

const VIEWER_DOCUMENTATION_NOTICE =
  'התיעוד אינו זמין בהרשאת צפייה; הועברתם לעמוד היום.'

export function getVisibleMemoryProfileTabs(
  authorizationRole,
) {
  if (authorizationRole !== 'viewer') {
    return MEMORY_PROFILE_TABS
  }

  return MEMORY_PROFILE_TABS.filter(
    (tab) =>
      tab.id !==
      MEMORY_PROFILE_TAB_IDS.documentation,
  )
}

export function resolveMemoryProfileTab(
  requestedTab,
  authorizationRole,
) {
  const visibleTabs =
    getVisibleMemoryProfileTabs(
      authorizationRole,
    )
  const requestedTabIsVisible =
    visibleTabs.some(
      (tab) => tab.id === requestedTab,
    )

  if (requestedTabIsVisible) {
    return {
      activeTab: requestedTab,
      notice: '',
      shouldReplaceUrl: false,
    }
  }

  const viewerRequestedDocumentation =
    authorizationRole === 'viewer' &&
    requestedTab ===
      MEMORY_PROFILE_TAB_IDS.documentation

  return {
    activeTab: MEMORY_PROFILE_TAB_IDS.today,
    notice: viewerRequestedDocumentation
      ? VIEWER_DOCUMENTATION_NOTICE
      : '',
    shouldReplaceUrl: true,
  }
}

export function createMemoryProfileTabSearch(
  currentSearch,
  tabId,
) {
  const searchParams =
    new URLSearchParams(currentSearch)

  searchParams.set('tab', tabId)

  return `?${searchParams.toString()}`
}

export function getRtlTabTargetIndex(
  key,
  currentIndex,
  itemCount,
) {
  if (itemCount < 1) {
    return -1
  }

  const directionByKey = {
    ArrowLeft: 1,
    ArrowRight: -1,
    Home: -currentIndex,
    End:
      itemCount - currentIndex - 1,
  }
  const direction = directionByKey[key]

  if (direction === undefined) {
    return -1
  }

  return (
    currentIndex +
    direction +
    itemCount
  ) % itemCount
}
