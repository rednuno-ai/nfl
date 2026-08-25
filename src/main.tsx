import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initRepository } from "@data/index";
import { seedDefaultAccounts } from "@data/auth";

// Fire-and-forget: if Supabase env vars are present in a real deployment,
// this swaps the active repository over before the user's first save. In
// this sandbox (no env vars set) it resolves immediately to the local
// repository already in use — see src/data/index.ts.
void initRepository();

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

// Awaited so the seeded demo account (adm/adm) is guaranteed to exist
// before the login screen becomes interactive.
seedDefaultAccounts().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
