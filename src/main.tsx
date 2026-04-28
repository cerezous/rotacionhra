import React from "react";
import ReactDOM from "react-dom/client";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HeroUIProvider locale="es-CL">
      <main className="flex min-h-0 h-dvh flex-col overflow-hidden bg-background text-foreground">
        <App />
      </main>
      <ToastProvider placement="bottom-right" />
    </HeroUIProvider>
  </React.StrictMode>,
);
