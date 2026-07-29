import {
  ADTS,
  BufferSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from 'mediabunny'
import { AppError } from '../../errors/AppError.js'
import { MAX_RECORDING_SIZE_BYTES } from './MemoryRecording.js'
import {
  detectRecordingAudioFormat,
  isRecordingContentCompatibleWithMimeType,
  RECORDING_AUDIO_FORMATS,
} from './recordingAudioFormat.js'

function createPreparationError(
  message,
  {
    statusCode = 422,
    code =
      'TRANSCRIPTION_AUDIO_NORMALIZATION_FAILED',
  } = {},
) {
  return new AppError(message, {
    statusCode,
    code,
  })
}

function replaceFileExtension(
  fileName,
  extension,
) {
  const lastDotIndex =
    fileName.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return `${fileName}${extension}`
  }

  return `${fileName.slice(
    0,
    lastDotIndex,
  )}${extension}`
}

async function convertAdtsWithMediabunny(
  audioBuffer,
) {
  const target = new BufferTarget()

  try {
    const input = new Input({
      source: new BufferSource(
        new Uint8Array(
          audioBuffer.buffer,
          audioBuffer.byteOffset,
          audioBuffer.byteLength,
        ),
      ),
      formats: [ADTS],
    })

    const output = new Output({
      format: new Mp4OutputFormat(),
      target,
    })

    const conversion =
      await Conversion.init({
        input,
        output,
        showWarnings: false,
      })

    if (
      !conversion.isValid ||
      conversion.utilizedTracks.length !==
        1
    ) {
      throw new Error(
        'AAC conversion did not produce one usable track.',
      )
    }

    await conversion.execute()
  } catch {
    throw createPreparationError(
      'Recording audio could not be normalized for transcription.',
    )
  }

  if (
    !(target.buffer instanceof ArrayBuffer) ||
    target.buffer.byteLength === 0
  ) {
    throw createPreparationError(
      'Recording audio could not be normalized for transcription.',
    )
  }

  return Buffer.from(target.buffer)
}

function discardDerivedBuffer(
  buffer,
  originalBuffer,
) {
  if (
    Buffer.isBuffer(buffer) &&
    buffer !== originalBuffer
  ) {
    buffer.fill(0)
  }
}

async function normalizeAdtsAudio(
  audioBuffer,
  converter,
) {
  let normalizedBuffer

  try {
    normalizedBuffer =
      await converter(audioBuffer)
  } catch {
    throw createPreparationError(
      'Recording audio could not be normalized for transcription.',
    )
  }

  if (
    !Buffer.isBuffer(normalizedBuffer) ||
    normalizedBuffer.length === 0 ||
    normalizedBuffer === audioBuffer
  ) {
    discardDerivedBuffer(
      normalizedBuffer,
      audioBuffer,
    )

    throw createPreparationError(
      'Recording audio could not be normalized for transcription.',
    )
  }

  if (
    normalizedBuffer.length >
    MAX_RECORDING_SIZE_BYTES
  ) {
    discardDerivedBuffer(
      normalizedBuffer,
      audioBuffer,
    )

    throw createPreparationError(
      'Normalized recording audio exceeds the transcription size limit.',
      {
        statusCode: 413,
        code:
          'TRANSCRIPTION_AUDIO_TOO_LARGE',
      },
    )
  }

  if (
    detectRecordingAudioFormat(
      normalizedBuffer,
    ) !==
    RECORDING_AUDIO_FORMATS
      .ISO_BASE_MEDIA
  ) {
    discardDerivedBuffer(
      normalizedBuffer,
      audioBuffer,
    )

    throw createPreparationError(
      'Recording audio could not be normalized for transcription.',
    )
  }

  return normalizedBuffer
}

export function createTranscriptionAudioPreparer(
  {
    convertAdtsToM4a =
      convertAdtsWithMediabunny,
  } = {},
) {
  if (
    typeof convertAdtsToM4a !==
    'function'
  ) {
    throw new TypeError(
      'AAC-to-M4A converter must be a function.',
    )
  }

  return async function prepareRecordingForTranscription({
    audioBuffer,
    originalFileName,
    mimeType,
  }) {
    const detectedFormat =
      detectRecordingAudioFormat(
        audioBuffer,
      )

    if (
      !detectedFormat ||
      !isRecordingContentCompatibleWithMimeType(
        mimeType,
        audioBuffer,
      )
    ) {
      throw createPreparationError(
        'Recording audio format is invalid or does not match its declared type.',
        {
          code:
            'TRANSCRIPTION_AUDIO_FORMAT_INVALID',
        },
      )
    }

    if (
      detectedFormat !==
      RECORDING_AUDIO_FORMATS
        .AAC_ADTS
    ) {
      return Object.freeze({
        audioBuffer,
        originalFileName,
        mimeType,
        wasNormalized: false,
        release() {},
      })
    }

    const normalizedBuffer =
      await normalizeAdtsAudio(
        audioBuffer,
        convertAdtsToM4a,
      )

    let wasReleased = false

    return Object.freeze({
      audioBuffer:
        normalizedBuffer,

      originalFileName:
        replaceFileExtension(
          originalFileName,
          '.m4a',
        ),

      mimeType: 'audio/mp4',
      wasNormalized: true,

      release() {
        if (!wasReleased) {
          normalizedBuffer.fill(0)
          wasReleased = true
        }
      },
    })
  }
}

export const prepareRecordingForTranscription =
  createTranscriptionAudioPreparer()