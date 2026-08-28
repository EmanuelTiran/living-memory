import {
  archiveMemoryAsset,
  createMemoryAssetAccessLink,
  createMemoryAsset,
  getMemoryAssetFile,
  getMemoryAssetFileWithAccessToken,
  listMemoryAssets,
  updateMemoryAssetMetadata,
} from './memoryAssetService.js'

function encodeFileName(fileName) {
  return encodeURIComponent(fileName)
    .replace(/'/g, '%27')
}

function createContentDisposition(
  asset,
  disposition,
) {
  const fallbackExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }

  const fallbackFileName =
    `memory-file${fallbackExtensions[asset.mimeType] ?? ''}`

  return `${disposition}; filename="${fallbackFileName}"; filename*=UTF-8''${encodeFileName(asset.originalFileName)}`
}

function sendPrivateFile(
  res,
  asset,
  buffer,
  disposition,
) {
  let wasDiscarded = false

  function discardBuffer() {
    if (!wasDiscarded) {
      buffer.fill(0)
      wasDiscarded = true
    }
  }

  res.once('finish', discardBuffer)
  res.once('close', discardBuffer)

  res.set({
    'Cache-Control':
      'private, no-store, max-age=0',
    'Content-Disposition':
      createContentDisposition(
        asset,
        disposition,
      ),
    'Content-Length':
      buffer.length.toString(),
    'Content-Type': asset.mimeType,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  })

  res.status(200).send(buffer)
}

export async function uploadAsset(
  req,
  res,
) {
  const asset = await createMemoryAsset(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.body,
    req.file,
  )

  delete req.file

  res.status(201).json({
    success: true,
    data: {
      asset,
    },
  })
}

export async function listAssets(
  req,
  res,
) {
  const assets = await listMemoryAssets(
    req.auth.userId,
    req.validatedParams.memoryId,
  )

  res.status(200).json({
    success: true,
    data: {
      assets,
    },
  })
}

export async function viewAssetFile(
  req,
  res,
) {
  const { asset, buffer } =
    await getMemoryAssetFile(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.assetId,
    )

  sendPrivateFile(
    res,
    asset,
    buffer,
    'inline',
  )
}

export async function downloadAssetFile(
  req,
  res,
) {
  const { asset, buffer } =
    await getMemoryAssetFile(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.assetId,
    )

  sendPrivateFile(
    res,
    asset,
    buffer,
    'attachment',
  )
}

export async function createAssetAccessLink(
  req,
  res,
) {
  const access =
    await createMemoryAssetAccessLink(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.assetId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      access,
    },
  })
}

export async function accessAssetFile(
  req,
  res,
) {
  const {
    asset,
    buffer,
    disposition,
  } =
    await getMemoryAssetFileWithAccessToken(
      req.validatedParams.memoryId,
      req.validatedParams.assetId,
      req.validatedQuery.token,
    )

  sendPrivateFile(
    res,
    asset,
    buffer,
    disposition,
  )
}

export async function updateAssetMetadata(
  req,
  res,
) {
  const asset =
    await updateMemoryAssetMetadata(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.assetId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      asset,
    },
  })
}

export async function archiveAsset(
  req,
  res,
) {
  const asset = await archiveMemoryAsset(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.validatedParams.assetId,
  )

  res.status(200).json({
    success: true,
    data: {
      asset,
    },
  })
}
