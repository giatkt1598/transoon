import { createRoot } from "react-dom/client";
import { TranslationAppProvider } from "./app/translation-app-context";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <TranslationAppProvider>
    <App />
  </TranslationAppProvider>,
);
