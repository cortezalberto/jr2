/**
 * Shared WebSocket client with reconnection, heartbeat, and event subscription.
 * Used by Dashboard, pwaMenu, and pwaWaiter.
 *
 * Usage:
 *   import { createWebSocketClient } from '../../shared/websocket-client'
 *   const ws = createWebSocketClient({ baseUrl: 'ws://localhost:8001' })
 *   ws.connect('/ws/admin', token)
 *   ws.on('ROUND_SUBMITTED', handler)
 */

export interface WSClientConfig {
  baseUrl: string
  heartbeatInterval?: number // ms, default 30000
  heartbeatTimeout?: number // ms, default 10000
  maxReconnectAttempts?: number // default 50
  maxReconnectDelay?: number // ms, default 30000
  initialReconnectDelay?: number // ms, default 1000
  jitterFactor?: number // 0-1, default 0.3
  nonRecoverableCodes?: number[] // default [4001, 4003, 4029]
}

export type EventHandler = (event: any) => void
export type ConnectionHandler = (connected: boolean) => void

export interface WSClient {
  connect(endpoint: string, token: string): void
  disconnect(): void
  softDisconnect(): void
  updateToken(token: string): void
  on(eventType: string, handler: EventHandler): () => void
  onConnectionChange(handler: ConnectionHandler): () => void
  isConnected(): boolean
  getLastCloseCode(): number | null
}

export function createWebSocketClient(config: WSClientConfig): WSClient {
  const {
    baseUrl,
    heartbeatInterval = 30000,
    heartbeatTimeout = 10000,
    maxReconnectAttempts = 50,
    maxReconnectDelay = 30000,
    initialReconnectDelay = 1000,
    jitterFactor = 0.3,
    nonRecoverableCodes = [4001, 4003, 4029],
  } = config

  let socket: WebSocket | null = null
  let currentEndpoint = ''
  let currentToken = ''
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  let lastCloseCode: number | null = null

  const listeners = new Map<string, Set<EventHandler>>()
  const connectionListeners = new Set<ConnectionHandler>()

  function emit(type: string, data: any) {
    listeners.get(type)?.forEach((h) => h(data))
    listeners.get('*')?.forEach((h) => h(data))
  }

  function notifyConnection(connected: boolean) {
    connectionListeners.forEach((h) => h(connected))
  }

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
        heartbeatTimeoutTimer = setTimeout(() => {
          socket?.close(1000, 'Heartbeat timeout')
        }, heartbeatTimeout)
      }
    }, heartbeatInterval)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    if (heartbeatTimeoutTimer) clearTimeout(heartbeatTimeoutTimer)
    heartbeatTimer = null
    heartbeatTimeoutTimer = null
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) return

    const delay = Math.min(
      initialReconnectDelay * Math.pow(2, reconnectAttempts),
      maxReconnectDelay,
    )
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1)

    reconnectTimer = setTimeout(() => {
      reconnectAttempts++
      doConnect()
    }, delay + jitter)
  }

  function doConnect() {
    if (socket?.readyState === WebSocket.OPEN) return

    const url = `${baseUrl}${currentEndpoint}?token=${currentToken}`
    socket = new WebSocket(url)

    socket.onopen = () => {
      reconnectAttempts = 0
      notifyConnection(true)
      startHeartbeat()
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'pong') {
          if (heartbeatTimeoutTimer) clearTimeout(heartbeatTimeoutTimer)
          return
        }
        emit(data.type, data)
      } catch {
        /* ignore non-JSON */
      }
    }

    socket.onclose = (event) => {
      lastCloseCode = event.code
      stopHeartbeat()
      notifyConnection(false)

      if (!nonRecoverableCodes.includes(event.code)) {
        scheduleReconnect()
      }
    }

    socket.onerror = () => {
      // onclose will fire after onerror
    }
  }

  return {
    connect(endpoint: string, token: string) {
      currentEndpoint = endpoint
      currentToken = token
      reconnectAttempts = 0
      doConnect()
    },

    disconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stopHeartbeat()
      reconnectAttempts = maxReconnectAttempts // prevent reconnect
      socket?.close(1000, 'Client disconnect')
      socket = null
      listeners.clear()
      connectionListeners.clear()
    },

    softDisconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stopHeartbeat()
      reconnectAttempts = maxReconnectAttempts
      socket?.close(1000, 'Soft disconnect')
      socket = null
      // Keep listeners
    },

    updateToken(token: string) {
      currentToken = token
      if (socket?.readyState === WebSocket.OPEN) {
        this.softDisconnect()
        reconnectAttempts = 0
        doConnect()
      }
    },

    on(eventType: string, handler: EventHandler): () => void {
      if (!listeners.has(eventType)) listeners.set(eventType, new Set())
      listeners.get(eventType)!.add(handler)
      return () => {
        listeners.get(eventType)?.delete(handler)
        if (listeners.get(eventType)?.size === 0) listeners.delete(eventType)
      }
    },

    onConnectionChange(handler: ConnectionHandler): () => void {
      connectionListeners.add(handler)
      return () => connectionListeners.delete(handler)
    },

    isConnected: () => socket?.readyState === WebSocket.OPEN,
    getLastCloseCode: () => lastCloseCode,
  }
}
