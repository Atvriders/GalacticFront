type Handler<T> = (data: T) => void;

export class EventBus {
  private listeners: Map<string, Set<Handler<unknown>>> = new Map();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T>(event: string, handler: Handler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<unknown>);
    return () => {
      this.listeners.get(event)?.delete(handler as Handler<unknown>);
    };
  }

  /** Subscribe once; auto-unsubscribes after the first emit. Returns an unsubscribe function. */
  once<T>(event: string, handler: Handler<T>): () => void {
    const wrapper: Handler<T> = (data) => {
      handler(data);
      this.listeners.get(event)?.delete(wrapper as Handler<unknown>);
    };
    return this.on<T>(event, wrapper);
  }

  /** Emit an event to all subscribed handlers. */
  emit<T>(event: string, data: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      (handler as Handler<T>)(data);
    }
  }

  /** Remove all handlers for a specific event. */
  off(event: string): void {
    this.listeners.delete(event);
  }

  /** Remove all handlers for all events. */
  clear(): void {
    this.listeners.clear();
  }

  /** Number of handlers registered for an event. */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
