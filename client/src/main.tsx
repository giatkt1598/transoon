import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { createRoot } from 'react-dom/client'
import { TranslationAppProvider } from './app/translation-app-context'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#efe5d6',
      paper: 'rgba(255, 250, 242, 0.88)',
    },
    text: {
      primary: '#35261b',
      secondary: '#594534',
    },
  },
  typography: {
    fontFamily: '"Aptos", "Trebuchet MS", "Segoe UI", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 16,
  },
})

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <TranslationAppProvider>
      <App />
    </TranslationAppProvider>
  </ThemeProvider>,
)
