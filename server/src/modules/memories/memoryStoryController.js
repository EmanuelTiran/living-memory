import {
    approveMemoryStory,
    archiveMemoryStory,
    createMemoryStory,
    listMemoryStories,
    updateMemoryStory,
  } from './memoryStoryService.js'

  export async function createStory(req, res) {
    const memoryStory =
      await createMemoryStory(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedBody,
      )

    res.status(201).json({
      success: true,
      data: {
        memoryStory,
      },
    })
  }

  export async function listStories(req, res) {
    const memoryStories =
      await listMemoryStories(
        req.auth.userId,
        req.validatedParams.memoryId,
      )

    res.status(200).json({
      success: true,
      data: {
        memoryStories,
      },
    })
  }

  export async function approveStory(req, res) {
    const memoryStory =
      await approveMemoryStory(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.storyId,
      )

    res.status(200).json({
      success: true,
      data: {
        memoryStory,
      },
    })
  }

  export async function updateStory(req, res) {
    const memoryStory =
      await updateMemoryStory(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.storyId,
        req.validatedBody,
      )

    res.status(200).json({
      success: true,
      data: {
        memoryStory,
      },
    })
  }

  export async function archiveStory(req, res) {
    await archiveMemoryStory(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.storyId,
    )

    res.status(204).send()
  }
