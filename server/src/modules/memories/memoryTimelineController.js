import {
  listMemoryTimeline,
} from './memoryTimelineService.js'

export async function getMemoryTimeline(
  req,
  res,
) {
  const timeline =
    await listMemoryTimeline(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      timeline,
    },
  })
}
