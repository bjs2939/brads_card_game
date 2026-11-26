import { useRef, useState } from "react";
import CardFace from "./CardFace";
import { Feedback, MatchHistory, gameVersion } from "./PlaytestPanels";
import SimpleGame, { difficulties, simpleVersionTitle, type Difficulty } from "./SimpleGame";
import { useBackgroundMusic } from "./useGameSound";
import "./Homepage.css";

const difficultyDescriptions: Record<Difficulty, string> = {
  Sandbox: "The opponent never attacks.",
  Easy: "A gentler opponent with warnings before known immune attacks.",
  Normal: "A balanced opponent for a standard match.",
  Hard: "Even the best players will struggle.",
};

export default function HomePage() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [trainingGrounds, setTrainingGrounds] = useState(false);
  const [chooseDifficulty, setChooseDifficulty] = useState(false);
  const [showingResult, setShowingResult] = useState(false);
  const modePicker = useRef<HTMLDialogElement>(null);
  const music = useBackgroundMusic(!difficulty ? "menu" : showingResult ? null : "battle");

  function goHome() {
    setShowingResult(false);
    setTrainingGrounds(false);
    setDifficulty(null);
  }

  function launchMatch(level: Difficulty, training = false) {
    modePicker.current?.close();
    music.start("battle");
    setTrainingGrounds(training);
    setDifficulty(level);
  }

  if (difficulty) {
    return <SimpleGame difficulty={difficulty} trainingGrounds={trainingGrounds} onBack={goHome} music={music} onResultChange={setShowingResult} />;
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
          <div className="playtest-actions">
            <button type="button" className="playtest-button" onClick={() => launchMatch("Sandbox", true)}>Training Grounds</button>
            <Feedback context={`Version ${gameVersion} · Main menu`} />
            <MatchHistory />
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
            <div className="difficulty-row" key={level}>
              <button className={level === "Normal" ? "game-home-primary" : undefined} onClick={() => launchMatch(level)}>{level}</button>
              <div className="difficulty-info">
                <button type="button" aria-label={`About ${level} difficulty`} aria-describedby={`difficulty-${level}`}
                  onClick={event => event.currentTarget.focus()}>i</button>
                <span role="tooltip" id={`difficulty-${level}`}>{difficultyDescriptions[level]}</span>
              </div>
            </div>
          )) : (
            <>
              <button disabled>Campaign <small>Coming soon</small></button>
              <button type="button" onClick={() => launchMatch("Easy")}>Tutorial</button>
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
