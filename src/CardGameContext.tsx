//CardGameContext.tsx
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\src\CardGameContext.tsx

import React, { createContext, useContext, useState, ReactNode } from "react";
import { smartLog } from "../src/smartLog";

type CardGameContextType = {
  playerName: string;
  setPlayerName: (name: string) => void;
};

const CardGameContext = createContext<CardGameContextType | undefined>(undefined);

type CardGameProviderProps = {
  children: ReactNode;
};

function CardGameProvider({ children }: CardGameProviderProps) {
  smartLog("context provider initialized");

  const [playerName, setPlayerNameState] = useState("");

  function setPlayerName(name: string) {
    smartLog("player name update requested with {name}");

    const previousName = playerName;
    setPlayerNameState(name);

    smartLog(
      "player name changed from {previousName} to {name}"
    );
  }

  const contextValue: CardGameContextType = {
    playerName,
    setPlayerName,
  };

  smartLog(
    "context value prepared with playerName={playerName || 'empty'}"
  );

  return (
    <CardGameContext.Provider value={contextValue}>
      {children}
    </CardGameContext.Provider>
  );
}

function useCardGameContext() {
  const context = useContext(CardGameContext);

  if (!context) {
    smartLog(
      "context lookup failed, hook used outside provider"
    );
    throw new Error("card game context missing provider");
  }

  smartLog(
    "context accessed with playerName={context.playerName || 'empty'}"
  );

  return context;
}

export { CardGameProvider, useCardGameContext };