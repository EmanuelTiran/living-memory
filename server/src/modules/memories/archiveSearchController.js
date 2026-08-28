import {
  searchMemoryArchive,
} from './archiveSearchService.js'

export async function searchArchive(
  req,
  res,
) {
  const search =
    await searchMemoryArchive(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedQuery,
    )

  res.status(200).json({
    success: true,
    data: {
      search,
    },
  })
}
