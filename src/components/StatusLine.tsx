import * as React from "react"
import { Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

export type StatusLevel = "info" | "success" | "warning" | "error"
export type StatusCategory = "connection" | "audio" | "openai" | "simli" | "error" | "user"
export type DisplayMode = "basic" | "detailed" | "debug"

export interface StatusMessage {
  timestamp: number
  category: StatusCategory
  message: string
  level: StatusLevel
  details?: Record<string, unknown>
}

interface StatusLineProps {
  messages: StatusMessage[]
  onClear?: () => void
  className?: string
}

const levelColors: Record<StatusLevel, string> = {
  success: "text-emerald-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  info: "text-white",
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", { hour12: false })
}

const formatDetailsForDebug = (details?: Record<string, unknown>): string => {
  if (!details || Object.keys(details).length === 0) return ""

  const pairs = Object.entries(details).map(([key, value]) => {
    if (typeof value === "object") {
      return `${key}: ${JSON.stringify(value)}`
    }
    return `${key}: ${value}`
  })

  return ` [${pairs.join(", ")}]`
}

const copyToClipboard = (messages: StatusMessage[], mode: DisplayMode) => {
  const formatted = messages.map((msg) => {
    const timestamp = formatTimestamp(msg.timestamp)
    const base = `${timestamp} | ${msg.category}: ${msg.message}`

    if (mode === "debug" && msg.details) {
      return base + formatDetailsForDebug(msg.details)
    }

    return base
  }).join("\n")

  navigator.clipboard.writeText(formatted).then(() => {
    toast("Log copied to clipboard")
  }).catch(() => {
    toast("Failed to copy log", "error")
  })
}

export const StatusLine: React.FC<StatusLineProps> = ({
  messages,
  onClear,
  className
}) => {
  const [mode, setMode] = React.useState<DisplayMode>("basic")
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isCollapsed])

  const latestMessage = messages[messages.length - 1]

  const renderBasicMode = () => {
    if (!latestMessage) {
      return <span className="text-zinc-500 text-xs sm:text-sm">waiting for connection...</span>
    }

    return (
      <span className={cn("font-medium text-xs sm:text-sm break-words", levelColors[latestMessage.level])}>
        <span className="text-zinc-400">{latestMessage.category}</span>
        <span className="mx-1.5">|</span>
        <span>{latestMessage.message}</span>
      </span>
    )
  }

  const renderDetailedMode = () => {
    if (messages.length === 0) {
      return <div className="text-zinc-500 text-xs sm:text-sm">no messages yet</div>
    }

    return (
      <div
        ref={scrollRef}
        className="space-y-1 overflow-y-auto overflow-x-hidden max-h-[80px] sm:max-h-[120px] pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      >
        {messages.map((msg, idx) => (
          <div
            key={`${msg.timestamp}-${idx}`}
            className={cn("text-xs sm:text-sm font-mono break-words", levelColors[msg.level])}
          >
            <span className="text-zinc-500 text-[10px] sm:text-xs">{formatTimestamp(msg.timestamp)}</span>
            <span className="mx-1 sm:mx-2">|</span>
            <span className="text-zinc-400">{msg.category}:</span>
            <span className="ml-1 sm:ml-2">{msg.message}</span>
          </div>
        ))}
      </div>
    )
  }

  const renderDebugMode = () => {
    if (messages.length === 0) {
      return <div className="text-zinc-500 text-xs sm:text-sm">no messages yet</div>
    }

    return (
      <div
        ref={scrollRef}
        className="space-y-1 overflow-y-auto overflow-x-hidden max-h-[80px] sm:max-h-[120px] pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      >
        {messages.map((msg, idx) => (
          <div
            key={`${msg.timestamp}-${idx}`}
            className={cn("text-[10px] sm:text-xs font-mono break-words", levelColors[msg.level])}
          >
            <span className="text-zinc-500">{formatTimestamp(msg.timestamp)}</span>
            <span className="mx-1 sm:mx-2">|</span>
            <span className="text-zinc-400">{msg.category}:</span>
            <span className="ml-1 sm:ml-2">
              {msg.message}
              {msg.details && (
                <span className="text-zinc-500">
                  {formatDetailsForDebug(msg.details)}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-full bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-sm",
        "px-3 sm:px-4 py-2 sm:py-3",
        "flex flex-col sm:flex-row items-start gap-2 sm:gap-4",
        "relative z-50",
        className
      )}
    >
      <div className="flex-1 min-w-0 w-full sm:w-auto order-2 sm:order-1">
        {isCollapsed ? (
          <div className="text-sm text-zinc-500">status line collapsed</div>
        ) : mode === "basic" ? (
          <div className="py-0.5">{renderBasicMode()}</div>
        ) : mode === "detailed" ? (
          renderDetailedMode()
        ) : (
          renderDebugMode()
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start order-1 sm:order-2">
        <div className="flex gap-0.5 sm:gap-1 border border-zinc-700 rounded-md overflow-hidden">
          <button
            onClick={() => setMode("basic")}
            className={cn(
              "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium transition-colors",
              mode === "basic"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            Basic
          </button>
          <button
            onClick={() => setMode("detailed")}
            className={cn(
              "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium transition-colors border-x border-zinc-700",
              mode === "detailed"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            Detailed
          </button>
          <button
            onClick={() => setMode("debug")}
            className={cn(
              "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium transition-colors",
              mode === "debug"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            Debug
          </button>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => copyToClipboard(messages, mode)}
          className="h-7 w-7 sm:h-8 sm:w-8"
          disabled={messages.length === 0}
          title="Copy log to clipboard"
        >
          <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={onClear}
          className="h-7 w-7 sm:h-8 sm:w-8"
          disabled={messages.length === 0}
          title="Clear log"
        >
          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 sm:h-8 sm:w-8"
          title={isCollapsed ? "Expand status line" : "Collapse status line"}
        >
          {isCollapsed ? (
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
