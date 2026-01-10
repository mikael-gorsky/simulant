import { useState, useEffect, useRef } from 'react'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusLine } from './components/StatusLine'
import { MicrophoneIndicator } from './components/MicrophoneIndicator'
import { LoadingOverlay } from './components/LoadingOverlay'
import { Toaster } from './components/ui/toaster'
import { useStatusMessages } from './hooks/useStatusMessages'
import { SessionManager } from './services/session-manager'
import { toast } from './lib/toast'
import { getAllApiKeys, getSetting } from './services/settings-storage'
import type { ConnectionState } from './types/websocket'

const DEFAULT_FACE_ID = '6ebf0aa7-6fed-443d-a4c6-fd1e3080b215'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [isStarting, setIsStarting] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [validatedFaceId, setValidatedFaceId] = useState<string | null>(null)
  const [isCheckingConfig, setIsCheckingConfig] = useState(true)
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false)
  const [hasSimliKey, setHasSimliKey] = useState(false)
  const [hasPreview, setHasPreview] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const { messages, addMessage, clearMessages } = useStatusMessages()
  const sessionManagerRef = useRef<SessionManager | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const healthCheckInterval = useRef<number | null>(null)

  useEffect(() => {
    checkConfiguration()

    return () => {
      if (sessionManagerRef.current) {
        sessionManagerRef.current.destroy()
      }
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current)
      }
    }
  }, [addMessage])

  async function checkConfiguration() {
    setIsCheckingConfig(true)

    addMessage({
      category: "connection",
      message: "checking configuration...",
      level: "info"
    })

    try {
      const apiKeys = await getAllApiKeys()
      const openAIKey = apiKeys['openai']
      const simliKey = apiKeys['simli']

      setHasOpenAIKey(!!openAIKey)
      setHasSimliKey(!!simliKey)

      const savedFaceId = await getSetting('simliFaceId') as string | null
      const faceId = savedFaceId || DEFAULT_FACE_ID
      setValidatedFaceId(faceId)

      addMessage({
        category: "connection",
        message: "application initialized",
        level: "info"
      })

      if (openAIKey && simliKey) {
        addMessage({
          category: "connection",
          message: "API keys configured and ready",
          level: "info"
        })
        addMessage({
          category: "connection",
          message: `using face ID: ${faceId}`,
          level: "info"
        })

        initializePreview(faceId)
      } else {
        const missing = []
        if (!openAIKey) missing.push('OpenAI')
        if (!simliKey) missing.push('Simli')

        addMessage({
          category: "connection",
          message: `missing API keys: ${missing.join(', ')}`,
          level: "warning"
        })
        addMessage({
          category: "connection",
          message: "configure API keys in settings to begin",
          level: "warning"
        })
      }
    } catch (error) {
      console.error('[Configuration Check Error]', error)
      addMessage({
        category: "error",
        message: "failed to load configuration",
        level: "error"
      })
    } finally {
      setIsCheckingConfig(false)
    }
  }

  async function initializePreview(faceId: string) {
    try {
      const sessionManager = new SessionManager({ faceId })

      sessionManager.on('status', (status) => {
        addMessage(status)
      })

      sessionManager.on('stateChange', ({ newState }) => {
        console.log('[State Change]', connectionState, '->', newState)
      })

      if (videoRef.current) {
        sessionManager.getVideoHandler().setVideoElement(videoRef.current)
      }

      sessionManagerRef.current = sessionManager

      await sessionManager.startPreview()
      setHasPreview(true)
    } catch (error) {
      console.error('[Preview Error]', error)
      setHasPreview(false)
    }
  }

  useEffect(() => {
    if (connectionState === 'active' && !healthCheckInterval.current) {
      healthCheckInterval.current = window.setInterval(() => {
        if (sessionManagerRef.current?.isConnected()) {
          addMessage({
            category: 'connection',
            message: 'connection health check passed',
            level: 'info'
          })
        } else {
          addMessage({
            category: 'error',
            message: 'connection health check failed',
            level: 'warning'
          })
        }
      }, 10000)
    } else if (connectionState !== 'active' && healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current)
      healthCheckInterval.current = null
    }

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current)
        healthCheckInterval.current = null
      }
    }
  }, [connectionState, addMessage])

  return (
    <>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <StatusLine messages={messages} onClear={clearMessages} />

        <header className="border-b border-zinc-800 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold">AI Voice Chatbot</h1>
            <div className="flex items-center gap-2">
              {connectionState === 'active' && (
                <span className="text-xs sm:text-sm text-emerald-500 font-medium flex items-center gap-1.5 sm:gap-2">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="w-full flex flex-col items-center">
            <div className="text-center text-xs sm:text-sm text-zinc-400 mb-4 font-medium px-4">
              {getStatusText()}
            </div>

            <div className="flex justify-center mb-4 relative">
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-[90vw] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px] aspect-[3/4] flex items-center justify-center relative overflow-hidden shadow-2xl">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ display: connectionState === 'active' || hasPreview ? 'block' : 'none' }}
                  autoPlay
                  playsInline
                  aria-label="Avatar video stream"
                />
                {connectionState !== 'active' && !hasPreview && validatedFaceId && (
                  <img
                    src={`https://simli.ai/faceImages/${validatedFaceId}.png`}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                    }}
                  />
                )}
                {connectionState !== 'active' && !hasPreview && !validatedFaceId && (
                  <div className="text-center text-zinc-500">
                    <div className="text-5xl sm:text-6xl mb-3 sm:mb-4 animate-pulse">🎭</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center items-center gap-2 sm:gap-3 w-full max-w-[90vw] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
              <button
                onClick={handleStartConversation}
                disabled={connectionState !== 'idle' || isStarting || isCheckingConfig || !hasOpenAIKey || !hasSimliKey}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex-shrink-0"
                style={{
                  boxShadow: '0 6px 8px rgba(0, 0, 0, 0.3), inset 0 -3px 6px rgba(0, 0, 0, 0.3), inset 0 3px 6px rgba(255, 255, 255, 0.2)'
                }}
                aria-label="Start conversation"
                title={!hasOpenAIKey || !hasSimliKey ? 'Configure API keys in settings first' : 'Start conversation'}
              />

              <button
                onClick={handleToggleMute}
                disabled={connectionState !== 'active'}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-600 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex-shrink-0"
                style={{
                  boxShadow: '0 6px 8px rgba(0, 0, 0, 0.3), inset 0 -3px 6px rgba(0, 0, 0, 0.3), inset 0 3px 6px rgba(255, 255, 255, 0.2)'
                }}
                aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              />

              <button
                onClick={() => setSettingsOpen(true)}
                disabled={connectionState !== 'idle'}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-600 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex-shrink-0 text-xl sm:text-2xl"
                style={{
                  boxShadow: '0 6px 8px rgba(0, 0, 0, 0.3), inset 0 -3px 6px rgba(0, 0, 0, 0.3), inset 0 3px 6px rgba(255, 255, 255, 0.2)'
                }}
                aria-label="Open settings"
              >
                ⚙️
              </button>

              <button
                onClick={handleEndCall}
                disabled={connectionState !== 'active'}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex-shrink-0"
                style={{
                  boxShadow: '0 6px 8px rgba(0, 0, 0, 0.3), inset 0 -3px 6px rgba(0, 0, 0, 0.3), inset 0 3px 6px rgba(255, 255, 255, 0.2)'
                }}
                aria-label="End call"
              />
            </div>

          </div>
        </main>
      </div>

      <MicrophoneIndicator isActive={connectionState === 'active'} audioLevel={audioLevel} />
      <LoadingOverlay message={loadingMessage} show={isStarting} />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open)
          if (!open) {
            checkConfiguration()
          }
        }}
        onFaceIdValidated={setValidatedFaceId}
      />
      <Toaster />
    </>
  )

  function getConnectionIndicator() {
    const dotStyle = {
      position: 'absolute' as const,
      top: '8px',
      right: '8px',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      border: '2px solid white'
    }

    switch (connectionState) {
      case 'idle':
        return <div style={{ ...dotStyle, backgroundColor: '#71717a' }} />
      case 'connecting':
      case 'connected':
        return <div style={{ ...dotStyle, backgroundColor: '#eab308' }} />
      case 'ready':
      case 'active':
        return <div style={{ ...dotStyle, backgroundColor: '#10b981' }} />
      case 'error':
        return <div style={{ ...dotStyle, backgroundColor: '#ef4444' }} />
      default:
        return null
    }
  }

  function getStatusText(): string {
    if (isCheckingConfig) {
      return 'Checking configuration...'
    }

    switch (connectionState) {
      case 'idle':
        if (!hasOpenAIKey || !hasSimliKey) {
          return 'Configure API keys in settings to begin'
        }
        return 'Click the green button to start conversation'
      case 'connecting':
        return 'Connecting to services...'
      case 'connected':
        return 'Initializing session...'
      case 'ready':
        return 'Systems ready, starting audio capture...'
      case 'active':
        return 'Conversation active - speak to interact'
      case 'ending':
        return 'Ending session...'
      case 'error':
        return 'Connection error - check status log'
      default:
        return 'Ready'
    }
  }

  async function handleStartConversation() {
    if (connectionState !== 'idle') return

    setIsStarting(true)
    setLoadingMessage('Initializing session...')

    try {
      let sessionManager = sessionManagerRef.current

      // If we have a preview session, pause it (but keep connection alive for reuse)
      if (sessionManager && hasPreview) {
        console.log('[App] Pausing preview before starting full conversation')
        setLoadingMessage('Launching...')
        sessionManager.stopPreview(true) // Keep connection alive for reuse

        // Small delay to ensure audio cleanup completes
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (!sessionManager || !hasPreview) {
        setLoadingMessage('Launching...')
        sessionManager = new SessionManager({
          faceId: validatedFaceId || DEFAULT_FACE_ID
        })
        sessionManagerRef.current = sessionManager

        sessionManager.on('status', (status) => {
          addMessage(status)
          console.log('[Status]', status)
        })

        sessionManager.on('stateChange', ({ oldState, newState }) => {
          console.log('[State Change]', oldState, '->', newState)
          setConnectionState(newState)
        })

        sessionManager.on('audioLevel', (level: number) => {
          setAudioLevel(level)
        })

        sessionManager.on('disconnected', () => {
          toast.error('Disconnected from services')
          setConnectionState('idle')
          setLoadingMessage('')
        })

        sessionManager.on('ended', () => {
          setConnectionState('idle')
          sessionManagerRef.current = null
          setLoadingMessage('')
          setHasPreview(false)
        })

        if (videoRef.current) {
          sessionManager.getVideoHandler().setVideoElement(videoRef.current)
        }
      }

      setLoadingMessage('Upgrading to full session...')
      await sessionManager.initialize()

      setLoadingMessage('Connecting to AI services...')
      await sessionManager.startSession()

      setLoadingMessage('')
      setHasPreview(false)
      toast.success('Conversation started successfully')

    } catch (error) {
      console.error('[Error] Failed to start conversation:', error)
      toast.error('Failed to start conversation. Check your settings and try again.')

      addMessage({
        category: 'error',
        message: error instanceof Error ? error.message : 'Failed to start conversation',
        level: 'error'
      })

      setConnectionState('idle')
      setLoadingMessage('')
      if (sessionManagerRef.current) {
        sessionManagerRef.current.destroy()
        sessionManagerRef.current = null
      }
    } finally {
      setIsStarting(false)
    }
  }

  function handleToggleMute() {
    if (!sessionManagerRef.current || connectionState !== 'active') return

    const newMutedState = !isMicMuted
    sessionManagerRef.current.setMicrophoneMuted(newMutedState)
    setIsMicMuted(newMutedState)

    toast.success(newMutedState ? 'Microphone muted' : 'Microphone unmuted')
  }

  async function handleEndCall() {
    if (!sessionManagerRef.current || connectionState !== 'active') return

    console.log('[Action] Ending call')

    try {
      setLoadingMessage('Ending session...')
      await sessionManagerRef.current.endSession()
      setIsMicMuted(false)
      toast.success('Conversation ended')

      if (validatedFaceId && hasOpenAIKey && hasSimliKey) {
        await initializePreview(validatedFaceId)
      }
    } catch (error) {
      console.error('[Error] Failed to end conversation:', error)
      toast.error('Failed to end conversation gracefully')
    } finally {
      sessionManagerRef.current = null
      setConnectionState('idle')
      setLoadingMessage('')
    }
  }
}

export default App;
