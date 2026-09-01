export function getMemoryChatLauncherState({
  hasApprovedSources,
  isCheckingSources,
  sourceCheckFailed,
}) {
  if (isCheckingSources) {
    return 'checking'
  }

  if (sourceCheckFailed) {
    return 'error'
  }

  return hasApprovedSources
    ? 'ready'
    : 'empty'
}
