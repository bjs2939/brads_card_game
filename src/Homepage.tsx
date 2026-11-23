import { useRef, useState } from "react";
import CardFace from "./CardFace";
import SimpleGame, { difficulties, simpleVersionTitle, type Difficulty } from "./SimpleGame";
import { useBackgroundMusic } from "./useGameSound";
import "./Homepage.css";

export default function HomePage() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [chooseDifficulty, setChooseDifficulty] = useState(false);
  const [showingResult, setShowingResult] = useState(false);
  const modePicker = useRef<HTMLDialogElement>(null);
  const music = useBackgroundMusic(!difficulty ? "menu" : showingResult ? null : "battle");

  function goHome() {
    setShowingResult(false);
    setDifficulty(null);
  }

  if (difficulty) {
    return <SimpleGame difficulty={difficulty} onBack={goHome} music={music} onResultChange={setShowingResult} />;
  }

  return (
    <main className="game-home">
      <div className="game-home-panel">
        <div className="game-home-cards" aria-hidden="true">
          <CardFace card={{ type: "standard", rank: "K", suit: "hearts" }} />
          <CardFace card={{ type: "standard", rank: "A", suit: "spades" }} />
          <CardFace card={{ type: "joker", color: "black" }} />
        </div>
        <div className="game-home-content">
          <h1>{simpleVersionTitle}</h1>
          <p>Build your battlefield and take the opposing castle.</p>
          <div className="game-home-actions">
            <button className="game-home-primary" aria-haspopup="dialog" onClick={() => { setChooseDifficulty(false); modePicker.current?.showModal(); }}>Play Brad’s Card Game</button>
          </div>
          <button className="game-home-music" data-music-toggle aria-pressed={music.enabled} onClick={music.toggle}>
            {music.enabled ? "Mute Music" : "Play Music"}
          </button>
        </div>
      </div>
      <dialog ref={modePicker} className="game-mode-picker" aria-labelledby="game-mode-title">
        <h2 id="game-mode-title">{chooseDifficulty ? "Choose a difficulty" : "Choose a game mode"}</h2>
        <div className="game-mode-options">
          {chooseDifficulty ? difficulties.map(level => (
            <button key={level} className={level === "Normal" ? "game-home-primary" : undefined} onClick={() => {
              modePicker.current?.close();
              music.start("battle");
              setDifficulty(level);
            }}>{level}</button>
          )) : (
            <>
              <button className="game-home-primary" onClick={() => setChooseDifficulty(true)}>VS Computer</button>
              <button disabled>Online Matchmaking <small>Coming soon</small></button>
              <button disabled>VS Friend <small>Coming soon</small></button>
            </>
          )}
        </div>
        <button className="game-mode-back" onClick={() => {
          if (chooseDifficulty) setChooseDifficulty(false);
          else modePicker.current?.close();
        }}>Back</button>
      </dialog>
    </main>
  );
}
