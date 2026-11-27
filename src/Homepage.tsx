import { useEffect, useRef, useState } from "react";
import TutorialIntro from "./TutorialIntro";
import CardFace from "./CardFace";
import { Feedback, MatchHistory, gameVersion } from "./PlaytestPanels";
import SimpleGame, { difficulties, simpleVersionTitle, type Difficulty } from "./SimpleGame";
import { useBackgroundMusic } from "./useGameSound";
import FriendLobby, { inviteCode } from "./FriendLobby";
import "./Homepage.css";

const difficultyDescriptions: Record<Difficulty, string> = {
  Sandbox: "The opponent never attacks.",
  Easy: "A gentler opponent with warnings before known immune attacks.",
  Normal: "A balanced opponent for a standard match.",
  Hard: "Even the best players will struggle.",
};

export default function HomePage() {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("brads-card-game:player-name")?.trim().slice(0, 24) ?? "");
  const [nameDraft, setNameDraft] = useState(playerName);
  const [editingName, setEditingName] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [trainingGrounds, setTrainingGrounds] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [menu, setMenu] = useState<"modes" | "difficulty" | "tutorial" | "friend">(() => import.meta.env.DEV && inviteCode() ? "friend" : "modes");
  const [showingResult, setShowingResult] = useState(false);
  const [garbageMusic, setGarbageMusic] = useState(false);
  const tutorialAudio = useRef<AudioContext | null>(null);
  const modePicker = useRef<HTMLDialogElement>(null);
  const music = useBackgroundMusic(!difficulty ? "menu" : showingResult ? null : garbageMusic ? "garbage-collection" : "battle");

  useEffect(() => {
    if (import.meta.env.DEV && inviteCode()) modePicker.current?.showModal();
  }, []);

  function stopTutorialAudio() {
    const audio = tutorialAudio.current;
    tutorialAudio.current = null;
    if (audio) void audio.close().catch(() => {});
  }

  function openTutorial() {
    modePicker.current?.close();
    try {
      if (window.AudioContext && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const audio = new AudioContext();
        tutorialAudio.current = audio;
        void audio.resume().catch(() => {});
      }
    } catch {
      // The dialogue can still be read when audio is unavailable.
    }
    setShowIntro(true);
  }

  function goHome() {
    stopTutorialAudio();
    setShowingResult(false);
    setGarbageMusic(false);
    setTrainingGrounds(false);
    setTutorial(false);
    setShowIntro(false);
    setDifficulty(null);
  }

  function launchMatch(level: Difficulty, training = false, tutorialMatch = false) {
    if (!tutorialMatch) stopTutorialAudio();
    modePicker.current?.close();
    music.start("battle");
    setTrainingGrounds(training);
    setTutorial(tutorialMatch);
    setShowIntro(false);
    setDifficulty(level);
  }

  if (showIntro) {
    return <TutorialIntro audio={tutorialAudio.current} onDeal={() => launchMatch("Easy", false, true)} onExit={goHome} />;
  }

  if (difficulty) {
    return <SimpleGame difficulty={difficulty} trainingGrounds={trainingGrounds} tutorial={tutorial} tutorialAudio={tutorialAudio.current} onBack={goHome} music={music} onResultChange={setShowingResult} onGarbageMusicChange={setGarbageMusic} />;
  }

  return (
    <main className="game-home">
      <button className="game-home-profile playtest-button" type="button" aria-haspopup="dialog" onClick={() => {
        setNameDraft(playerName);
        setEditingName(true);
        modePicker.current?.showModal();
      }}>Profile{playerName && <span className="game-home-profile-name">{playerName}</span>}</button>
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
            <button className="game-home-primary" aria-haspopup="dialog" onClick={() => { setEditingName(false); setMenu("modes"); modePicker.current?.showModal(); }}>Play Brad’s Card Game</button>
          </div>
          <div className="playtest-actions">
            <Feedback context={`Version ${gameVersion} · Main menu`} />
            <MatchHistory />
          </div>
          <button className="game-home-music" data-music-toggle aria-pressed={music.enabled} onClick={music.toggle}>
            {music.enabled ? "Mute Music" : "Play Music"}
          </button>
        </div>
      </div>
      <dialog ref={modePicker} className="game-mode-picker" aria-labelledby="game-mode-title">
        <h2 id="game-mode-title">{editingName ? "Profile" : !playerName ? "Choose a player name" : menu === "difficulty" ? "Choose a difficulty" : menu === "tutorial" ? "Choose a tutorial" : menu === "friend" ? "VS Friend" : "Choose a game mode"}</h2>
        <div className="game-mode-options">
          {editingName || !playerName ? (
            <form className="friend-lobby" onSubmit={event => {
              event.preventDefault();
              const name = nameDraft.trim();
              if (!name) return;
              localStorage.setItem("brads-card-game:player-name", name);
              setPlayerName(name);
              setEditingName(false);
              if (editingName) modePicker.current?.close();
            }}>
              {editingName && <p><strong>Temporary Account</strong><br />Your username is saved in this browser. Registered accounts are coming soon.</p>}
              <label>{editingName ? "Username" : "Player name"} <input autoComplete="nickname" maxLength={24} required value={nameDraft}
                onChange={event => setNameDraft(event.target.value)} /></label>
              <button type="submit" disabled={!nameDraft.trim()}>{editingName ? "Save name" : "Continue"}</button>
            </form>
          ) : menu === "friend" ? <FriendLobby playerName={playerName} /> : menu === "difficulty" ? difficulties.map(level => (
            <div className="difficulty-row" key={level}>
              <button onClick={() => launchMatch(level)}>{level}</button>
              <div className="difficulty-info">
                <button type="button" aria-label={`About ${level} difficulty`} aria-describedby={`difficulty-${level}`}
                  onClick={event => event.currentTarget.focus()}>i</button>
                <span role="tooltip" id={`difficulty-${level}`}>{difficultyDescriptions[level]}</span>
              </div>
            </div>
          )) : menu === "tutorial" ? (
            <>
              <button type="button" onClick={openTutorial}>Tutorial 1 – Basic Gameplay</button>
              <button disabled>Tutorial 2 – Garbage Collection <small>Coming soon</small></button>
              <button disabled>Tutorial 3 – Conversions <small>Coming soon</small></button>
            </>
          ) : (
            <>
              <button disabled>Campaign <small>Coming soon</small></button>
              <button type="button" onClick={() => setMenu("tutorial")}>Tutorial</button>
              <button onClick={() => setMenu("difficulty")}>VS Computer</button>
              <button disabled>Online Matchmaking <small>Coming soon</small></button>
              {import.meta.env.DEV ? <button onClick={() => setMenu("friend")}>VS Friend</button>
                : <button disabled>VS Friend <small>Coming soon</small></button>}
              <button type="button" onClick={() => launchMatch("Sandbox", true)}>Training Grounds</button>
            </>
          )}
        </div>
        <button className="game-mode-back" onClick={() => {
          if (editingName || !playerName) modePicker.current?.close();
          else if (menu !== "modes") setMenu("modes");
          else modePicker.current?.close();
        }}>Back</button>
      </dialog>
    </main>
  );
}
