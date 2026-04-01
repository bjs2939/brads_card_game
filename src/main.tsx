//main.tsx
//C:\Users\bjs29\OneDrive\Desktop\Programs\brads_card_game\src\main.tsx
import { smartLog } from "./smart_log";
import { useCardGameContext } from "./CardGameContext";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);