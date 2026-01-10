type EventListener = (...args: any[]) => void

export class EventEmitter {
  private events: Map<string, EventListener[]> = new Map()

  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(listener)
    return this
  }

  once(event: string, listener: EventListener): this {
    const onceWrapper = (...args: any[]) => {
      listener(...args)
      this.off(event, onceWrapper)
    }
    return this.on(event, onceWrapper)
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event)
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => listener(...args))
      return true
    }
    return false
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
    return this
  }

  listenerCount(event: string): number {
    const listeners = this.events.get(event)
    return listeners ? listeners.length : 0
  }
}
