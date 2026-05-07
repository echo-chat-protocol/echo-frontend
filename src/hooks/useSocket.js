import { useEffect, useRef, useCallback } from 'react'
import { getSocket } from '@services/socket'

/**
 * Subscribes to a socket event and cleans up automatically on unmount.
 * Re-renders are avoided by using a ref for the handler.
 *
 * @param {string} event - Socket event name
 * @param {Function} handler - Callback to invoke when event fires
 *
 * @example
 *   useSocketEvent('message', (msg) => setMessages(prev => [...prev, msg]));
 */
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const socket = getSocket()
    const listener = (...args) => handlerRef.current(...args)
    socket.on(event, listener)
    return () => socket.off(event, listener)
  }, [event])
}

/**
 * Returns a stable `emit` function that safely sends events.
 * Logs a warning if the socket is not connected.
 *
 * @returns {{ emit: (event: string, data?: any) => void }}
 *
 * @example
 *   const { emit } = useSocketEmit();
 *   emit('send_message', { content: 'Hello' });
 */
export function useSocketEmit() {
  const emit = useCallback((event, data) => {
    const socket = getSocket()
    if (socket.connected) {
      socket.emit(event, data)
    } else {
      console.warn('[Socket] Attempted to emit while disconnected:', event)
    }
  }, [])

  return { emit }
}

/**
 * Returns the current connection status of the socket.
 *
 * @returns {{ connected: boolean }}
 */
export function useSocketStatus() {
  const socket = getSocket()
  return { connected: socket.connected }
}
