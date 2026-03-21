import { io, type Socket } from 'socket.io-client'
import { socketUrl } from './config'

let appSocket: Socket | null = null

export function getAppSocket() {
  appSocket ??= io(socketUrl, {
    transports: ['websocket', 'polling'],
  })

  return appSocket
}
