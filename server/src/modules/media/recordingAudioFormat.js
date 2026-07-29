export const RECORDING_AUDIO_FORMATS = Object.freeze({
    AAC_ADTS: 'aac_adts',
    ISO_BASE_MEDIA: 'iso_base_media',
    MP3: 'mp3',
    WAV: 'wav',
    WEBM: 'webm',
  })

  const MAX_ISO_BOX_SCAN_BYTES = 4096
  const MAX_LEADING_ID3_TAGS = 4

  function isBufferWithLength(buffer, minimumLength) {
    return Buffer.isBuffer(buffer) && buffer.length >= minimumLength
  }

  function startsWithAscii(buffer, offset, value) {
    return (
      buffer.length >= offset + value.length &&
      buffer.subarray(offset, offset + value.length).toString('ascii') === value
    )
  }

  function getId3TagEndOffset(buffer, startOffset) {
    if (!startsWithAscii(buffer, startOffset, 'ID3')) {
      return startOffset
    }

    if (buffer.length < startOffset + 10) {
      return -1
    }

    const sizeBytes = buffer.subarray(startOffset + 6, startOffset + 10)

    if (Array.from(sizeBytes).some((value) => (value & 0x80) !== 0)) {
      return -1
    }

    const payloadSize =
      (sizeBytes[0] << 21) |
      (sizeBytes[1] << 14) |
      (sizeBytes[2] << 7) |
      sizeBytes[3]

    const hasFooter =
      (buffer[startOffset + 5] & 0x10) !== 0

    const endOffset =
      startOffset +
      10 +
      payloadSize +
      (hasFooter ? 10 : 0)

    return endOffset <= buffer.length
      ? endOffset
      : -1
  }

  function skipLeadingId3Tags(buffer) {
    let offset = 0

    for (
      let count = 0;
      count < MAX_LEADING_ID3_TAGS;
      count += 1
    ) {
      const nextOffset =
        getId3TagEndOffset(
          buffer,
          offset,
        )

      if (nextOffset === offset) {
        return offset
      }

      if (nextOffset < 0) {
        return -1
      }

      offset = nextOffset
    }

    return startsWithAscii(
      buffer,
      offset,
      'ID3',
    )
      ? -1
      : offset
  }

  function getAdtsFrameLength(
    buffer,
    offset,
  ) {
    if (
      buffer.length < offset + 7 ||
      buffer[offset] !== 0xff ||
      (buffer[offset + 1] & 0xf6) !==
        0xf0
    ) {
      return 0
    }

    const sampleRateIndex =
      (buffer[offset + 2] & 0x3c) >> 2

    if (sampleRateIndex > 12) {
      return 0
    }

    const headerLength =
      (buffer[offset + 1] & 0x01) ===
      0x01
        ? 7
        : 9

    if (
      buffer.length <
      offset + headerLength
    ) {
      return 0
    }

    const frameLength =
      ((buffer[offset + 3] & 0x03) <<
        11) |
      (buffer[offset + 4] << 3) |
      ((buffer[offset + 5] & 0xe0) >>
        5)

    if (
      frameLength < headerLength ||
      offset + frameLength >
        buffer.length
    ) {
      return 0
    }

    return frameLength
  }

  function isAdtsAac(buffer) {
    const offset =
      skipLeadingId3Tags(buffer)

    return (
      offset >= 0 &&
      getAdtsFrameLength(
        buffer,
        offset,
      ) > 0
    )
  }

  function isValidAdtsStream(buffer) {
    let offset =
      skipLeadingId3Tags(buffer)

    let frameCount = 0

    if (offset < 0) {
      return false
    }

    while (offset < buffer.length) {
      const id3EndOffset =
        getId3TagEndOffset(
          buffer,
          offset,
        )

      if (id3EndOffset < 0) {
        return false
      }

      if (id3EndOffset > offset) {
        offset = id3EndOffset
        continue
      }

      const frameLength =
        getAdtsFrameLength(
          buffer,
          offset,
        )

      if (frameLength === 0) {
        return false
      }

      frameCount += 1
      offset += frameLength
    }

    return frameCount > 0
  }

  function isMp3(buffer) {
    const offset =
      skipLeadingId3Tags(buffer)

    if (
      offset < 0 ||
      buffer.length < offset + 4
    ) {
      return false
    }

    const firstByte =
      buffer[offset]

    const secondByte =
      buffer[offset + 1]

    const thirdByte =
      buffer[offset + 2]

    const versionBits =
      (secondByte >> 3) & 0x03

    const layerBits =
      (secondByte >> 1) & 0x03

    const bitrateIndex =
      (thirdByte >> 4) & 0x0f

    const sampleRateIndex =
      (thirdByte >> 2) & 0x03

    return (
      firstByte === 0xff &&
      (secondByte & 0xe0) === 0xe0 &&
      versionBits !== 0x01 &&
      layerBits !== 0x00 &&
      bitrateIndex !== 0x00 &&
      bitrateIndex !== 0x0f &&
      sampleRateIndex !== 0x03
    )
  }

  function isIsoBaseMediaFile(buffer) {
    if (
      !isBufferWithLength(
        buffer,
        16,
      )
    ) {
      return false
    }

    const scanLimit = Math.min(
      buffer.length,
      MAX_ISO_BOX_SCAN_BYTES,
    )

    let offset = 0

    while (offset + 8 <= scanLimit) {
      const size32 =
        buffer.readUInt32BE(offset)

      const boxType = buffer
        .subarray(
          offset + 4,
          offset + 8,
        )
        .toString('ascii')

      let boxSize = size32
      let headerSize = 8

      if (size32 === 1) {
        if (
          offset + 16 >
          buffer.length
        ) {
          return false
        }

        const extendedSize =
          buffer.readBigUInt64BE(
            offset + 8,
          )

        if (
          extendedSize >
          BigInt(
            Number.MAX_SAFE_INTEGER,
          )
        ) {
          return false
        }

        boxSize =
          Number(extendedSize)

        headerSize = 16
      } else if (size32 === 0) {
        boxSize =
          buffer.length - offset
      }

      if (
        boxSize < headerSize ||
        offset + boxSize >
          buffer.length
      ) {
        return false
      }

      if (boxType === 'ftyp') {
        return boxSize >= 16
      }

      if (size32 === 0) {
        return false
      }

      offset += boxSize
    }

    return false
  }

  function isWav(buffer) {
    return (
      isBufferWithLength(
        buffer,
        12,
      ) &&
      startsWithAscii(
        buffer,
        0,
        'RIFF',
      ) &&
      startsWithAscii(
        buffer,
        8,
        'WAVE',
      )
    )
  }

  function isWebm(buffer) {
    return (
      isBufferWithLength(
        buffer,
        4,
      ) &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    )
  }

  export function detectRecordingAudioFormat(
    buffer,
  ) {
    if (!Buffer.isBuffer(buffer)) {
      return null
    }

    if (isIsoBaseMediaFile(buffer)) {
      return RECORDING_AUDIO_FORMATS
        .ISO_BASE_MEDIA
    }

    if (isWav(buffer)) {
      return RECORDING_AUDIO_FORMATS
        .WAV
    }

    if (isWebm(buffer)) {
      return RECORDING_AUDIO_FORMATS
        .WEBM
    }

    if (isAdtsAac(buffer)) {
      return RECORDING_AUDIO_FORMATS
        .AAC_ADTS
    }

    if (isMp3(buffer)) {
      return RECORDING_AUDIO_FORMATS
        .MP3
    }

    return null
  }

  export function isRecordingContentCompatibleWithMimeType(
    mimeType,
    buffer,
  ) {
    const detectedFormat =
      detectRecordingAudioFormat(
        buffer,
      )

    if (!detectedFormat) {
      return false
    }

    if (
      detectedFormat ===
        RECORDING_AUDIO_FORMATS
          .AAC_ADTS &&
      !isValidAdtsStream(buffer)
    ) {
      return false
    }

    const compatibleFormatsByMimeType = {
      'audio/mpeg': [
        RECORDING_AUDIO_FORMATS.MP3,
      ],

      'audio/mp4': [
        RECORDING_AUDIO_FORMATS
          .ISO_BASE_MEDIA,
        RECORDING_AUDIO_FORMATS
          .AAC_ADTS,
      ],

      'audio/x-m4a': [
        RECORDING_AUDIO_FORMATS
          .ISO_BASE_MEDIA,
        RECORDING_AUDIO_FORMATS
          .AAC_ADTS,
      ],

      'audio/wav': [
        RECORDING_AUDIO_FORMATS.WAV,
      ],

      'audio/x-wav': [
        RECORDING_AUDIO_FORMATS.WAV,
      ],

      'audio/webm': [
        RECORDING_AUDIO_FORMATS.WEBM,
      ],
    }

    return Boolean(
      compatibleFormatsByMimeType[
        mimeType
      ]?.includes(detectedFormat),
    )
  }
