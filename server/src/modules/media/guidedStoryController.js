import {
  listGuidedStories,
} from './guidedStoryService.js'

export async function listStories(
  req,
  res,
) {
  const stories = await listGuidedStories(
    req.auth.userId,
    req.validatedParams.memoryId,
  )

  res.status(200).json({
    success: true,
    data: {
      stories,
    },
  })
}
