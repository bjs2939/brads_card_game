//Homepage.tsx
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\src\Homepage.tsx

import React from "react";
import { smartLog } from "./smart_log";
import { useCardGameContext } from "./CardGameContext";

function HomePage() {
  smartLog("homepage rendered", { componentName: "HomePage" });

  const { setPlayerName } = useCardGameContext();

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Welcome to Brad’s Card Game</h1>

      <p>A turn-based multiplayer card game.</p>

      <div style={{ marginTop: "2rem" }}>
        <button
          style={{ marginRight: "1rem" }}
          onClick={() => {
            smartLog("pushed new game button", {
              componentName: "HomePage",
            });
            setPlayerName("Brad");
          }}
        >
          New Game
        </button>

        <button
          style={{ marginRight: "1rem" }}
          onClick={() => {
            smartLog("pushed new game vs computer button", {
              componentName: "HomePage",
            });

            // placeholder for next step
            setPlayerName("Brad");
          }}
        >
          New Game VS. Computer Player
        </button>

        <button
          onClick={() => {
            smartLog("pushed join game button", {
              componentName: "HomePage",
            });
          }}
        >
          Join Game
        </button>
      </div>
    </div>
  );
}

export default HomePage;