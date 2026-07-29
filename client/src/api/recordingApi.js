import { ApiError } from './authApi.js'

function createRecordingBasePath(memoryId) {
  return `/api/memories/${encodeURIComponent(memoryId)}/recordings`
}

async function request(memoryId, path, accessToken, { method = 'GET', body } = {}) {
  const options = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  }

  if (body instanceof FormData) {
    options.body = body
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'

    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(`${createRecordingBasePath(memoryId)}${path}`, options)
  } catch {
    throw new ApiError('Unable to connect to the server.', {
      code: 'NETWORK_ERROR',
    })
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? 'The request could not be completed.', {
      statusCode: response.status,
      code: payload?.error?.code ?? 'REQUEST_FAILED',
      details: payload?.error?.details ?? [],
    })
  }

  return payload?.data ?? null
}

export async function listMemoryRecordings(accessToken, memoryId) {
  const data = await request(memoryId, '', accessToken)

  return data.recordings
}

export async function createMemoryRecording(accessToken, memoryId, input) {
  const data = await request(memoryId, '', accessToken, {
    method: 'POST',
    body: input,
  })

  return data.recording
}

export async function uploadMemoryRecordingFile(
  accessToken,
  memoryId,
  recordingId,
  file,
) {
  const formData = new FormData()

  formData.append('recording', file, file.name)

  const data = await request(
    memoryId,
    `/${encodeURIComponent(recordingId)}/file`,
    accessToken,
    {
      method: 'PUT',
      body: formData,
    },
  )

  return data.recording
}

export async function requestMemoryRecordingTranscription(
  accessToken,
  memoryId,
  recordingId,
  input = {},
) {
  return request(
    memoryId,
    `/${encodeURIComponent(recordingId)}/transcription`,
    accessToken,
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function getMemoryRecordingTranscript(accessToken, memoryId, recordingId) {
  const data = await request(
    memoryId,
    `/${encodeURIComponent(recordingId)}/transcript`,
    accessToken,
  )

  return data.transcript
}

export async function updateMemoryRecordingTranscript(
  accessToken,
  memoryId,
  recordingId,
  input,
) {
  const data = await request(
    memoryId,
    `/${encodeURIComponent(recordingId)}/transcript`,
    accessToken,
    {
      method: 'PATCH',
      body: input,
    },
  )

  return data.transcript
}

export async function approveMemoryRecordingTranscript(
  accessToken,
  memoryId,
  recordingId,
  input,
) {
  return request(
    memoryId,
    `/${encodeURIComponent(recordingId)}/transcript/approval`,
    accessToken,
    {
      method: 'POST',
      body: input,
    },
  )
}