import { useState, useCallback } from "react"
import type { StatusMessage, StatusCategory, StatusLevel } from "@/components/StatusLine"

const MAX_MESSAGES = 100

interface AddMessageOptions {
  category: StatusCategory
  message: string
  level?: StatusLevel
  details?: Record<string, unknown>
}

export const useStatusMessages = () => {
  const [messages, setMessages] = useState<StatusMessage[]>([])

  const addMessage = useCallback(({
    category,
    message,
    level = "info",
    details
  }: AddMessageOptions) => {
    const newMessage: StatusMessage = {
      timestamp: Date.now(),
      category,
      message,
      level,
      details
    }

    setMessages((prev) => {
      const updated = [...prev, newMessage]
      if (updated.length > MAX_MESSAGES) {
        return updated.slice(updated.length - MAX_MESSAGES)
      }
      return updated
    })
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    addMessage,
    clearMessages
  }
}
