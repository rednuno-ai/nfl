import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initRepository } from "@data/index";
import { seedDefaultAccounts } from "@data/auth";
import { AppErrorBoundary } from "@ui/components/AppErrorBoundary";
import "./styles/index.css";
import "./styles/premium.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");
const rootContainer = container;

async function boot() {
  await initRepository();
  await seedDefaultAccounts();
  createRoot(rootContainer).render(
    <StrictMode>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </StrictMode>
  );
}

void boot().catch((error) => {
  console.error("GRIDIRON LIFE startup error", error);
  rootContainer.innerHTML = '<main class="app-error-page"><div class="card"><p class="screen-eyebrow">RECOVERY MODE</p><h1 class="page-title">Unable to start the game.</h1><p class="muted">Reload to try again. Local saves stay in this browser.</p><button class="btn btn-primary" type="button" onclick="location.reload()">Reload game</button></div></main>';
});
