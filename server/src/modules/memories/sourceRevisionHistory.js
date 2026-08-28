export const MAX_SOURCE_REVISION_HISTORY = 20

function resolveRevision(value) {
  return Number.isInteger(value) && value > 0
    ? value
    : 1
}

function resolveChangedAt(value) {
  return value instanceof Date
    ? value
    : new Date()
}

export function createStoryRevisionSnapshot(
  story,
  changedByUserId,
  changedAt,
) {
  return {
    revision: resolveRevision(
      story?.revision,
    ),
    title: String(story?.title ?? ''),
    content: String(
      story?.content ?? '',
    ),
    occurredOn: String(
      story?.occurredOn ?? '',
    ),
    reviewStatus:
      story?.status === 'approved'
        ? 'approved'
        : 'draft',
    approvedAt:
      story?.approvedAt ?? null,
    approvedByUserId:
      story?.approvedByUserId ?? null,
    changedAt:
      resolveChangedAt(changedAt),
    changedByUserId,
  }
}

export function createTranscriptRevisionSnapshot(
  transcript,
  changedByUserId,
  changedAt,
) {
  return {
    revision: resolveRevision(
      transcript?.revision,
    ),
    content: String(
      transcript?.content ?? '',
    ),
    reviewStatus:
      transcript?.reviewStatus ===
      'approved'
        ? 'approved'
        : 'draft',
    approvedAt:
      transcript?.approvedAt ?? null,
    approvedByUserId:
      transcript?.approvedByUserId ??
      null,
    changedAt:
      resolveChangedAt(changedAt),
    changedByUserId,
  }
}
