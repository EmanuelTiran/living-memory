import {
    archiveMemoryProfile,
    createMemoryProfile,
    getMemoryProfile,
    listMemoryProfiles,
    updateMemoryProfile,
  } from './memoryService.js'

  export async function createMemory(req, res) {
    const memoryProfile =
      await createMemoryProfile(
        req.auth.userId,
        req.validatedBody,
      )

    res.status(201).json({
      success: true,
      data: {
        memoryProfile,
      },
    })
  }

  export async function listMemories(req, res) {
    const memoryProfiles =
      await listMemoryProfiles(
        req.auth.userId,
      )

    res.status(200).json({
      success: true,
      data: {
        memoryProfiles,
      },
    })
  }

  export async function getMemory(req, res) {
    const memoryProfile =
      await getMemoryProfile(
        req.auth.userId,
        req.validatedParams.memoryId,
      )

    res.status(200).json({
      success: true,
      data: {
        memoryProfile,
      },
    })
  }

  export async function updateMemory(req, res) {
    const memoryProfile =
      await updateMemoryProfile(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedBody,
      )

    res.status(200).json({
      success: true,
      data: {
        memoryProfile,
      },
    })
  }

  export async function archiveMemory(req, res) {
    await archiveMemoryProfile(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

    res.status(204).send()
  }
