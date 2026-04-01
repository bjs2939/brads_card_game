// CardGameContext.tsx
// C:\Users\bjs29\OneDrive\Desktop\Programs\brads_card_game\src\CardGameContext.tsx

import React, { createContext, useContext, useState, ReactNode } from "react";
import { smartLog as log } from "./smart_log";

type Screen = "home" | "game";

type CardGameContextType = {
  playerName: string;
  setPlayerName: (name: string) => void;
  screen: Screen;
  setScreen: (screen: Screen) => void;
};

const CardGameContext = createContext<CardGameContextType | undefined>(undefined);

type CardGameProviderProps = {
  children: ReactNode;
};

function CardGameProvider({ children }: CardGameProviderProps) {
  log("context provider initialized");

  const [playerName, setPlayerNameState] = useState("");
  const [screen, setScreenState] = useState<Screen>("home");

  function setPlayerName(name: string) {
    log("player name update requested", { name });

    const previousName = playerName;
    setPlayerNameState(name);

    log("player name changed", { previousName, name });
  }

  function setScreen(newScreen: Screen) {
    log("screen change requested", { newScreen });

    const previousScreen = screen;
    setScreenState(newScreen);

    log("screen changed", { previousScreen, newScreen });
  }

  const contextValue: CardGameContextType = {
    playerName,
    setPlayerName,
    screen,
    setScreen,
  };

  log("context value prepared", {
    playerName: playerName || "empty",
    screen,
  });

  return (
    <CardGameContext.Provider value={contextValue}>
      {children}
    </CardGameContext.Provider>
  );
}

function useCardGameContext() {
  const context = useContext(CardGameContext);

  if (!context) {
    log("context lookup failed, hook used outside provider");
    throw new Error("card game context missing provider");
  }

  log("context accessed", {
    playerName: context.playerName || "empty",
    screen: context.screen,
  });

  return context;
}

export { CardGameProvider, useCardGameContext };