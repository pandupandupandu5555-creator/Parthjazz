import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

console.log("VITE_API_URL =",import.meta.env.VITE_API_URL);setBaseUrl(import.meta.env.VITE_API_URL);

createRoot(document.getElementById("root")!).render(<App />);
