import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { createRoot } from "react-dom/client";
import { ToastContainer } from "react-toastify";
import { TranslationAppProvider } from "./app/translation-app-context";
import "./index.css";
import "react-toastify/dist/ReactToastify.css";
import App from "./App.tsx";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#8a5a32",
      dark: "#6d4524",
      light: "#b27b52",
      contrastText: "#fff8ef",
    },
    secondary: {
      main: "#ead9c3",
      dark: "#d8c2a8",
      contrastText: "#5a4028",
    },
    background: {
      default: "#efe5d6",
      paper: "rgba(255, 250, 242, 0.88)",
    },
    text: {
      primary: "#35261b",
      secondary: "#594534",
    },
  },
  typography: {
    fontFamily: '"Aptos", "Trebuchet MS", "Segoe UI", sans-serif',
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: "small",
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 40,
          paddingInline: 16,
          fontWeight: 700,
        },
        containedPrimary: {
          backgroundColor: "#8a5a32",
          color: "#fff8ef",
          boxShadow: "0 10px 22px rgba(109, 69, 36, 0.18)",
          "&:hover": {
            backgroundColor: "#6d4524",
            boxShadow: "0 12px 24px rgba(109, 69, 36, 0.22)",
          },
        },
        outlined: {
          borderColor: "rgba(109, 69, 36, 0.22)",
        },
        outlinedPrimary: {
          color: "#6d4524",
          borderColor: "rgba(109, 69, 36, 0.22)",
          backgroundColor: "#fffaf4",
          "&:hover": {
            borderColor: "rgba(109, 69, 36, 0.36)",
            backgroundColor: "#f8efe3",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          color: "#35261b",
          boxShadow: "0 14px 32px rgba(53, 38, 27, 0.16)",
          border: "1px solid rgba(53, 38, 27, 0.08)",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          color: "#35261b",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          color: "#35261b",
        },
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <TranslationAppProvider>
      <App />
      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme="light"
      />
    </TranslationAppProvider>
  </ThemeProvider>,
);
