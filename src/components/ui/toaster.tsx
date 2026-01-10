import { useEffect, useState } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handleToast = (event: CustomEvent) => {
      const { message, type } = event.detail
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3000)
    }

    window.addEventListener('toast', handleToast as EventListener)
    return () => window.removeEventListener('toast', handleToast as EventListener)
  }, [])

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            px-4 py-3 rounded-lg shadow-lg border min-w-64 animate-in slide-in-from-right
            ${toast.type === 'success' ? 'bg-emerald-900 border-emerald-700 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-900 border-red-700 text-white' : ''}
            ${toast.type === 'info' ? 'bg-zinc-800 border-zinc-700 text-white' : ''}
          `}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <span className="text-lg">✓</span>}
            {toast.type === 'error' && <span className="text-lg">✕</span>}
            {toast.type === 'info' && <span className="text-lg">ℹ</span>}
            <span className="text-sm">{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
