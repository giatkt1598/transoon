import { RouterProvider } from 'react-router-dom'
import { AutoTranslateNotificationsProvider } from './app/auto-translate-notifications-context'
import { appRouter } from './app/router'
import './App.css'

function App() {
  return (
    <AutoTranslateNotificationsProvider>
      <RouterProvider router={appRouter} />
    </AutoTranslateNotificationsProvider>
  )
}

export default App
