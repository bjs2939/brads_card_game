//GameScreen.tsx
//C:\Users\bjs29\OneDrive\Desktop\Programs\brads_card_game\src\GameScreen.tsx

import React from "react";
import { smartLog as log } from "./smart_log";
import { useCardGameContext } from "./CardGameContext";

function GameScreen() {
  log("game screen rendered", { componentName: "GameScreen" });

  const { setScreen } = useCardGameContext();

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>VS. Computer Player</h1>

      <p>This is the placeholder game screen.</p>

      <p>Next step: game setup and basic turn flow.</p>

      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => {
            log("pushed back to home button", {
              componentName: "GameScreen",
            });
            setScreen("home");
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default GameScreen;