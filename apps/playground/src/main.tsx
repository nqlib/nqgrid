if (import.meta.env.DEV) {
  import("react-grab");
}

import { TooltipProvider } from "@nqlib/nqui";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { PlaygroundTableSettingsProvider } from "./playground-table-settings";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="nqgrid-playground-theme"
      themes={["light", "dark"]}
    >
      <TooltipProvider delayDuration={200}>
        <PlaygroundTableSettingsProvider>
          <App />
        </PlaygroundTableSettingsProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
