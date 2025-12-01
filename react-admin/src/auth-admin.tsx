import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AdminInvitationsApp } from "./AdminApp.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root container for admin app");
}

createRoot(rootElement).render(
  <StrictMode>
    <AdminInvitationsApp />
  </StrictMode>,
);
