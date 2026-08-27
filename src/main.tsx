import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initRepository } from "@data/index";
import { seedDefaultAccounts } from "@data/auth";
import "./styles/index.css";
import "./styles/premium.css";

void initRepository();

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

seedDefaultAccounts().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
