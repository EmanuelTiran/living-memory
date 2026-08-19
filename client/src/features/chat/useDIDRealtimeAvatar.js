import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

const REALTIME_START_TIMEOUT_MS =
  12000

const REALTIME_END_TIMEOUT_MS =
  120000

const initialState = {
  status: 'unavailable',
  error: '',
  mediaStream: null,
  streamAudioEnabled: false,
}

function createRealtimeError(message) {
  const error = new Error(message)
  error.code = 'DID_REALTIME_UNAVAILABLE'
  return error
}

export function getDIDRealtimeErrorMessage() {
  return 'השידור החי של D‑ID לא התחיל. הקול והתמונה המקומית ממשיכים לפעול.'
}

export function useDIDRealtimeAvatar({
  config,
  enabled,
}) {
  const [state, setState] =
    useState(initialState)

  const managerRef = useRef(null)
  const readyPromiseRef = useRef(null)
  const pendingStartRef = useRef(null)
  const pendingEndRef = useRef(null)
  const activeSpeechTypeRef = useRef(null)
  const generationRef = useRef(0)

  const available =
    config?.available === true &&
    typeof config.agentId === 'string' &&
    Boolean(config.agentId) &&
    typeof config.clientKey === 'string' &&
    Boolean(config.clientKey)

  const clearPendingStart = useCallback(
    (error) => {
      const pending = pendingStartRef.current

      if (!pending) {
        return
      }

      window.clearTimeout(
        pending.timeoutHandle,
      )
      pendingStartRef.current = null

      if (error) {
        pending.reject(error)
      } else {
        pending.resolve()
      }
    },
    [],
  )

  const clearPendingEnd = useCallback(
    (error) => {
      const pending = pendingEndRef.current

      if (!pending) {
        return
      }

      window.clearTimeout(
        pending.timeoutHandle,
      )
      pendingEndRef.current = null

      if (error) {
        pending.reject(error)
      } else {
        pending.resolve()
      }
    },
    [],
  )

  useEffect(() => {
    generationRef.current += 1
    const generation =
      generationRef.current
    let active = true

    const disconnectCurrent = async () => {
      const manager = managerRef.current

      managerRef.current = null
      readyPromiseRef.current = null

      if (manager) {
        await manager.disconnect()
          .catch(() => {})
      }
    }

    if (!available || !enabled) {
      void Promise.resolve().then(() => {
        if (active) {
          setState(initialState)
        }
      })

      void disconnectCurrent()

      return () => {
        active = false
        clearPendingStart(
          createRealtimeError(
            'Realtime avatar connection closed.',
          ),
        )
        clearPendingEnd(
          createRealtimeError(
            'Realtime avatar connection closed.',
          ),
        )
      }
    }

    const callbacks = {
      onSrcObjectReady(mediaStream) {
        if (!active) {
          return
        }

        setState((current) => ({
          ...current,
          mediaStream,
        }))
      },

      onConnectionStateChange(connectionState) {
        if (!active) {
          return
        }

        if (
          connectionState === 'connected' ||
          connectionState === 'completed'
        ) {
          setState((current) => ({
            ...current,
            status: 'ready',
            error: '',
            streamAudioEnabled: false,
          }))
          return
        }

        if (
          connectionState === 'fail' ||
          connectionState === 'closed'
        ) {
          const error = createRealtimeError(
            'D-ID realtime connection failed.',
          )

          clearPendingStart(error)
          clearPendingEnd(error)
          setState((current) => ({
            ...current,
            status: 'error',
            error:
              getDIDRealtimeErrorMessage(),
            streamAudioEnabled: false,
          }))
        }
      },

      onVideoStateChange(videoState) {
        if (!active) {
          return
        }

        if (videoState === 'START') {
          clearPendingStart()
          setState((current) => ({
            ...current,
            status: 'speaking',
            error: '',
            streamAudioEnabled:
              activeSpeechTypeRef.current ===
              'text',
          }))
          return
        }

        if (videoState === 'STOP') {
          clearPendingEnd()
          activeSpeechTypeRef.current = null
          setState((current) => ({
            ...current,
            status: 'ready',
            streamAudioEnabled: false,
          }))
        }
      },

      onError() {
        if (!active) {
          return
        }

        const error = createRealtimeError(
          'D-ID realtime request failed.',
        )

        clearPendingStart(error)
        clearPendingEnd(error)
        setState((current) => ({
          ...current,
          status: 'error',
          error:
            getDIDRealtimeErrorMessage(),
          streamAudioEnabled: false,
        }))
      },
    }

    const readyPromise =
      (async () => {
        await Promise.resolve()

        if (active) {
          setState({
            status: 'connecting',
            error: '',
            mediaStream: null,
            streamAudioEnabled: false,
          })
        }

        const {
          createAgentManager,
        } = await import(
          '@d-id/client-sdk'
        )

        const manager =
          await createAgentManager(
            config.agentId,
            {
              auth: {
                type: 'key',
                clientKey:
                  config.clientKey,
              },
              mode: 'DirectPlayback',
              callbacks,
              streamOptions: {
                compatibilityMode: 'on',
                streamWarmup: true,
                outputResolution: 512,
              },
              enableAnalytics: false,
              persistentChat: false,
            },
          )

        if (
          !active ||
          generationRef.current !==
            generation
        ) {
          await manager.disconnect()
            .catch(() => {})
          throw createRealtimeError(
            'Realtime avatar connection replaced.',
          )
        }

        managerRef.current = manager
        await manager.connect()

        return manager
      })()

    readyPromiseRef.current =
      readyPromise

    readyPromise.catch(() => {
      if (!active) {
        return
      }

      setState((current) => ({
        ...current,
        status: 'error',
        error:
          getDIDRealtimeErrorMessage(),
        streamAudioEnabled: false,
      }))
    })

    return () => {
      active = false
      clearPendingStart(
        createRealtimeError(
          'Realtime avatar connection closed.',
        ),
      )
      clearPendingEnd(
        createRealtimeError(
          'Realtime avatar connection closed.',
        ),
      )
      void disconnectCurrent()
    }
  }, [
    available,
    clearPendingEnd,
    clearPendingStart,
    config?.agentId,
    config?.clientKey,
    enabled,
  ])

  const speakCommand = useCallback(
    async (command, speechType) => {
      if (
        !available ||
        !enabled ||
        !readyPromiseRef.current
      ) {
        throw createRealtimeError(
          'Realtime avatar is unavailable.',
        )
      }

      const manager =
        await readyPromiseRef.current

      activeSpeechTypeRef.current =
        speechType

      clearPendingEnd(
        createRealtimeError(
          'Realtime avatar speech replaced.',
        ),
      )

      const ended = new Promise(
        (resolve, reject) => {
          const timeoutHandle =
            window.setTimeout(() => {
              pendingEndRef.current = null
              reject(
                createRealtimeError(
                  'Realtime avatar end timed out.',
                ),
              )
            }, REALTIME_END_TIMEOUT_MS)

          pendingEndRef.current = {
            resolve,
            reject,
            timeoutHandle,
            promise: null,
          }
        },
      )

      pendingEndRef.current.promise = ended
      void ended.catch(() => {})

      const started = new Promise(
        (resolve, reject) => {
          const timeoutHandle =
            window.setTimeout(() => {
              pendingStartRef.current = null
              reject(
                createRealtimeError(
                  'Realtime avatar start timed out.',
                ),
              )
            }, REALTIME_START_TIMEOUT_MS)

          pendingStartRef.current = {
            resolve,
            reject,
            timeoutHandle,
          }
        },
      )

      try {
        const request = Promise.resolve(
          manager.speak(command),
        )

        await Promise.race([
          started,
          request.then(() => started),
        ])
      } catch (error) {
        activeSpeechTypeRef.current = null
        clearPendingStart(error)
        clearPendingEnd(error)
        throw error
      }
    },
    [
      available,
      clearPendingEnd,
      clearPendingStart,
      enabled,
    ],
  )

  const speak = useCallback(
    (audioUrl) =>
      speakCommand(
        {
          type: 'audio',
          audio_url: audioUrl,
        },
        'audio',
      ),
    [speakCommand],
  )

  const speakText = useCallback(
    (text) => {
      const normalizedText =
        typeof text === 'string'
          ? text.trim()
          : ''

      if (!normalizedText) {
        throw createRealtimeError(
          'Realtime avatar text is required.',
        )
      }

      return speakCommand(
        {
          type: 'text',
          input: normalizedText,
        },
        'text',
      )
    },
    [speakCommand],
  )

  const stop = useCallback(() => {
    const manager = managerRef.current

    clearPendingStart(
      createRealtimeError(
        'Realtime avatar speech stopped.',
      ),
    )
    clearPendingEnd(
      createRealtimeError(
        'Realtime avatar speech stopped.',
      ),
    )

    const canInterrupt =
      manager?.getIsInterruptAvailable() ===
      true

    if (canInterrupt) {
      manager.interrupt({
        type: 'manual',
      })

      setState((current) => ({
        ...current,
        status: 'ready',
        streamAudioEnabled: false,
      }))
    }

    activeSpeechTypeRef.current = null
  }, [clearPendingEnd, clearPendingStart])

  const waitForSpeechEnd = useCallback(
    () =>
      pendingEndRef.current?.promise ??
      Promise.resolve(),
    [],
  )

  return {
    ...state,
    available,
    textSpeechAvailable:
      available &&
      config?.textSpeechAvailable === true,
    speak,
    speakText,
    waitForSpeechEnd,
    stop,
  }
}
