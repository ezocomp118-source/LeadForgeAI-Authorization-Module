import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { RegisterApp } from "./RegisterApp.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root container for register app");
}

createRoot(rootElement).render(
  <StrictMode>
    <RegisterApp />
  </StrictMode>,
);
