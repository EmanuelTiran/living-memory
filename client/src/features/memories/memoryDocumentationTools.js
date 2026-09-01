export const MEMORY_DOCUMENTATION_TOOL_IDS = {
  conversation: 'conversation',
  story: 'story',
  topics: 'topics',
}

const DOCUMENTATION_TOOL_HASHES = {
  [MEMORY_DOCUMENTATION_TOOL_IDS.conversation]:
    '#guided-interview',
  [MEMORY_DOCUMENTATION_TOOL_IDS.story]:
    '#stories-title',
  [MEMORY_DOCUMENTATION_TOOL_IDS.topics]:
    '#biography-topic-picker',
}

export const MEMORY_DOCUMENTATION_TOOLS = [
  {
    id: MEMORY_DOCUMENTATION_TOOL_IDS.conversation,
    label: 'שיחה קצרה',
    description:
      'שאלה אנושית אחת שאפשר לענות עליה בקול או בכתב.',
    badge: 'מומלץ',
    tooltip: 'להמשיך לשאלה הבאה בראיון',
  },
  {
    id: MEMORY_DOCUMENTATION_TOOL_IDS.story,
    label: 'כתיבת סיפור',
    description:
      'כתיבה חופשית של רגע, אירוע או זיכרון משפחתי.',
    tooltip: 'לכתוב סיפור חדש לארכיון',
  },
  {
    id: MEMORY_DOCUMENTATION_TOOL_IDS.topics,
    label: 'בחירת נושא',
    description:
      'בחירה מתוך נושאי החיים והשאלות שעדיין לא נענו.',
    tooltip: 'לבחור שאלה לפי נושא חיים',
  },
]

export function getVisibleDocumentationTools(
  canManage,
) {
  if (canManage) {
    return MEMORY_DOCUMENTATION_TOOLS
  }

  return MEMORY_DOCUMENTATION_TOOLS.filter(
    (tool) =>
      tool.id ===
      MEMORY_DOCUMENTATION_TOOL_IDS.story,
  )
}

export function getDocumentationToolHash(
  toolId,
) {
  return DOCUMENTATION_TOOL_HASHES[toolId] ?? ''
}

export function resolveDocumentationTool({
  canManage,
  hash,
  startGuidedInterview = false,
}) {
  if (!canManage) {
    return MEMORY_DOCUMENTATION_TOOL_IDS.story
  }

  if (startGuidedInterview) {
    return MEMORY_DOCUMENTATION_TOOL_IDS.conversation
  }

  return (
    Object.entries(
      DOCUMENTATION_TOOL_HASHES,
    ).find(
      ([, toolHash]) =>
        toolHash === hash,
    )?.[0] ?? ''
  )
}
