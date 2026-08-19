const jpegSignature = Buffer.from([
  0xff,
  0xd8,
  0xff,
])

const pngSignature = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
])

function hasPrefix(buffer, signature) {
  return (
    buffer.length >= signature.length &&
    buffer.subarray(
      0,
      signature.length,
    ).equals(signature)
  )
}

function isWebp(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') ===
      'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') ===
      'WEBP'
  )
}

function isPdf(buffer) {
  return (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') ===
      '%PDF-'
  )
}

export function isMemoryAssetContentCompatibleWithMimeType(
  mimeType,
  buffer,
) {
  if (!Buffer.isBuffer(buffer)) {
    return false
  }

  const validators = {
    'image/jpeg': () =>
      hasPrefix(buffer, jpegSignature),
    'image/png': () =>
      hasPrefix(buffer, pngSignature),
    'image/webp': () =>
      isWebp(buffer),
    'application/pdf': () =>
      isPdf(buffer),
  }

  return validators[mimeType]?.() ?? false
}
