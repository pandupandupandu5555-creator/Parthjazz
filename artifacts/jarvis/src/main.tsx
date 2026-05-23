
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

setBaseUrl("https://workspaceapi-server-production-6165.up.railway.app/api");

createRoot(document.getElementById("root")!).render(<App />);
