import { useEffect, useState } from 'react'

interface MicrophoneIndicatorProps {
  isActive: boolean
  audioLevel?: number
}

export function MicrophoneIndicator({ isActive, audioLevel = 0 }: MicrophoneIndicatorProps) {
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    if (audioLevel > 0.1) {
      setIsPulsing(true)
      const timeout = setTimeout(() => setIsPulsing(false), 200)
      return () => clearTimeout(timeout)
    }
  }, [audioLevel])

  if (!isActive) return null

  return (
    <div
      className="fixed bottom-4 left-4 sm:bottom-8 sm:left-8 flex items-center gap-2 sm:gap-3 bg-zinc-900/90 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3 rounded-full border border-zinc-800 shadow-lg z-40"
      role="status"
      aria-live="polite"
      aria-label="Microphone status"
    >
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 transition-all duration-200 ${
            isPulsing ? 'scale-125' : 'scale-100'
          }`}
        />
        <div
          className={`absolute inset-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-ping ${
            isPulsing ? 'opacity-75' : 'opacity-0'
          }`}
        />
      </div>
      <span className="text-xs sm:text-sm text-zinc-300 font-medium">
        {isPulsing ? 'Speaking...' : 'Listening'}
      </span>
      <div className="flex gap-0.5 items-end h-3 sm:h-4">
        {[1, 2, 3, 4, 5].map((bar) => (
          <div
            key={bar}
            className="w-0.5 sm:w-1 bg-red-500 rounded-full transition-all duration-150"
            style={{
              height: isPulsing && audioLevel * 100 > bar * 5 ? `${bar * 3}px` : '2px',
              opacity: isPulsing ? 1 : 0.3
            }}
          />
        ))}
      </div>
    </div>
  )
}
