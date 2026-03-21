export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export const socketUrl =
  import.meta.env.VITE_SOCKET_URL ?? apiBaseUrl
