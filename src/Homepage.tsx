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

const tutorialLessons = [
  ["Build your ranks", "Draw a card at the start of your turn. In Move Up, advance cards from your back rank to your front rank. In Move Out, deploy number cards and Jokers from your hand to your back rank. On your first turn, deploy and end your turn."],
  ["Attack and defend", "Select one of your front-rank cards, then select an enemy target. A front-rank card protects the enemy card directly behind it. A 6 has extra range. A normal attack ends your turn. Hearts beat Spades, Spades beat Clubs, and Clubs beat Hearts. An advantaged suit gains +1 power and blocks attacks from the suit it beats. Diamonds are neutral."],
  ["Try special cards", "Matching ranks from 2 to 7 can stack. Attach Jacks or Queens as shields. From your hand, Jacks can also Spy, Queens can grant Double Attack, Kings can defeat targets instantly, and Aces can steal them. Face-down Jokers can explode when attacked. Practice in Training Grounds, where the opponent never attacks."],
] as const;

export default function HomePage() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [trainingGrounds, setTrainingGrounds] = useState(false);
  const [menu, setMenu] = useState<"modes" | "difficulty" | "tutorial">("modes");
  const [lesson, setLesson] = useState(0);
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
            <button className="game-home-primary" aria-haspopup="dialog" onClick={() => { setMenu("modes"); modePicker.current?.showModal(); }}>Play Brad’s Card Game</button>
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
        <h2 id="game-mode-title">{menu === "tutorial" ? "Tutorial" : menu === "difficulty" ? "Choose a difficulty" : "Choose a game mode"}</h2>
        {menu === "tutorial" ? (
          <section aria-live="polite">
            <h3>{tutorialLessons[lesson][0]}</h3>
            <p>{tutorialLessons[lesson][1]}</p>
            <div className="playtest-actions">
              {lesson > 0 && <button type="button" onClick={() => setLesson(lesson - 1)}>Previous lesson</button>}
              {lesson < tutorialLessons.length - 1
                ? <button type="button" onClick={() => setLesson(lesson + 1)}>Next lesson</button>
                : <button type="button" onClick={() => launchMatch("Sandbox", true)}>Practice in Training Grounds</button>}
            </div>
          </section>
        ) : <div className="game-mode-options">
          {menu === "difficulty" ? difficulties.map(level => (
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
              <button type="button" onClick={() => { setLesson(0); setMenu("tutorial"); }}>Tutorial</button>
              <button className="game-home-primary" onClick={() => setMenu("difficulty")}>VS Computer</button>
              <button disabled>Online Matchmaking <small>Coming soon</small></button>
              <button disabled>VS Friend <small>Coming soon</small></button>
            </>
          )}
        </div>}
        <button className="game-mode-back" onClick={() => {
          if (menu !== "modes") setMenu("modes");
          else modePicker.current?.close();
        }}>Back</button>
      </dialog>
    </main>
  );
}
