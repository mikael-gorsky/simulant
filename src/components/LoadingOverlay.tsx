interface LoadingOverlayProps {
  message: string
  show: boolean
}

export function LoadingOverlay({ message, show }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-8 sm:pt-12 z-40">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 sm:p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
        <div className="relative w-12 h-12 sm:w-16 sm:h-16">
          <div className="absolute inset-0 border-4 border-zinc-700 rounded-full" />
          <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
        </div>
        <p className="text-zinc-300 text-center font-medium text-sm sm:text-base">{message}</p>
      </div>
    </div>
  )
}
