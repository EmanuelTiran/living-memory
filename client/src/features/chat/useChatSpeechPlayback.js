import {
    useCallback,
    useEffect,
    useRef,
    useState,
  } from 'react'
  import {
    getMemoryChatMessageSpeech,
  } from '../../api/chatApi.js'

  const initialSpeechState = {
    messageId: null,
    status: 'idle',
    error: '',
  }

  export function useChatSpeechPlayback({
    memoryId,
    conversationId,
    runAuthenticatedRequest,
    getErrorMessage,
  }) {
    const [
      speechState,
      setSpeechState,
    ] = useState(initialSpeechState)

    const audioRef = useRef(null)
    const objectUrlRef = useRef(null)
    const requestSequenceRef =
      useRef(0)
    const isMountedRef = useRef(true)

    const releaseAudio = useCallback(
      () => {
        const audio = audioRef.current

        if (audio) {
          audio.onended = null
          audio.onerror = null
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }

        audioRef.current = null

        if (objectUrlRef.current) {
          URL.revokeObjectURL(
            objectUrlRef.current,
          )

          objectUrlRef.current = null
        }
      },
      [],
    )

    useEffect(() => {
      isMountedRef.current = true

      return () => {
        isMountedRef.current = false
        requestSequenceRef.current += 1
        releaseAudio()
      }
    }, [releaseAudio])

    const stopSpeech = useCallback(
      () => {
        requestSequenceRef.current += 1
        releaseAudio()

        if (isMountedRef.current) {
          setSpeechState(
            initialSpeechState,
          )
        }
      },
      [releaseAudio],
    )

    const toggleSpeech = useCallback(
      async (messageId) => {
        const isCurrentMessage =
          speechState.messageId ===
          messageId

        const isActive =
          speechState.status ===
            'loading' ||
          speechState.status ===
            'playing'

        if (
          isCurrentMessage &&
          isActive
        ) {
          stopSpeech()
          return
        }

        if (
          !memoryId ||
          !conversationId
        ) {
          return
        }

        requestSequenceRef.current += 1

        const requestSequence =
          requestSequenceRef.current

        releaseAudio()

        setSpeechState({
          messageId,
          status: 'loading',
          error: '',
        })

        try {
          const audioBlob =
            await runAuthenticatedRequest(
              (accessToken) =>
                getMemoryChatMessageSpeech(
                  accessToken,
                  memoryId,
                  conversationId,
                  messageId,
                ),
            )

          if (
            !isMountedRef.current ||
            requestSequenceRef.current !==
              requestSequence
          ) {
            return
          }

          const objectUrl =
            URL.createObjectURL(audioBlob)

          const audio =
            new Audio(objectUrl)

          objectUrlRef.current =
            objectUrl

          audioRef.current = audio

          audio.onended = () => {
            if (
              audioRef.current !== audio
            ) {
              return
            }

            releaseAudio()

            if (isMountedRef.current) {
              setSpeechState(
                initialSpeechState,
              )
            }
          }

          audio.onerror = () => {
            if (
              audioRef.current !== audio
            ) {
              return
            }

            releaseAudio()

            if (isMountedRef.current) {
              setSpeechState({
                messageId,
                status: 'error',
                error:
                  'לא הצלחנו להשמיע את קובץ האודיו.',
              })
            }
          }

          await audio.play()

          if (
            !isMountedRef.current ||
            requestSequenceRef.current !==
              requestSequence ||
            audioRef.current !== audio
          ) {
            releaseAudio()
            return
          }

          setSpeechState({
            messageId,
            status: 'playing',
            error: '',
          })
        } catch (error) {
          if (
            !isMountedRef.current ||
            requestSequenceRef.current !==
              requestSequence
          ) {
            return
          }

          releaseAudio()

          setSpeechState({
            messageId,
            status: 'error',
            error:
              getErrorMessage(error),
          })
        }
      },
      [
        conversationId,
        getErrorMessage,
        memoryId,
        releaseAudio,
        runAuthenticatedRequest,
        speechState.messageId,
        speechState.status,
        stopSpeech,
      ],
    )

    return {
      speechState,
      toggleSpeech,
      stopSpeech,
    }
  }
