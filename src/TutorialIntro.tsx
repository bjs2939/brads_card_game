import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioForeground } from "./useGameSound";
import "./TutorialIntro.css";

const advisors = {
  locke: { name: "Locke", image: "locke.png" },
  garrison: { name: "Commander Garrison", image: "garrison.png" },
};

type DialogueLine = { speaker: keyof typeof advisors; text: string };

const introduction: readonly DialogueLine[] = [
  { speaker: "locke", text: "Name’s Locke. Thief. I got caught, and now teaching you cards counts as community service. Apparently my other suggestion, stealing back the evidence, was a nonstarter." },
  { speaker: "garrison", text: "Commander Garrison. I was ordered to supervise. Believe me, I asked whether there was a siege I could attend instead." },
  { speaker: "locke", text: "Good news, Commander: your wish came true. The player’s castle is under attack. Leave the battlefield empty and the enemy can march right into the castle." },
  { speaker: "garrison", text: "We each start by drawing five cards. Your opponent keeps their hand face down. Once you’ve seen your hand, I’ll show you where to deploy your soldiers." },
  { speaker: "garrison", text: "The court will be delighted to hear it. Draw your opening five cards." },
] as const;

const ranks = ["Computer back rank", "Computer front rank", "Your front rank", "Your back rank"];

function playTypingTick(audio: AudioContext, lowerPitch: boolean) {
  if (audio.state !== "running") return;
  const start = audio.currentTime;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(lowerPitch ? 255 : 380, start);
  volume.gain.setValueAtTime(0.025, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.032);
  tone.connect(volume).connect(audio.destination);
  tone.start(start);
  tone.stop(start + 0.035);
  tone.onended = () => { tone.disconnect(); volume.disconnect(); };
}

export default function TutorialIntro({ audio, onDeal, onExit }: {
  audio: AudioContext | null;
  onDeal: () => void;
  onExit: () => void;
}) {
  return (
    <main className="tutorial-intro">
      <div className="tutorial-field" aria-hidden="true">
        {ranks.map((rank, index) => (
          <div className={index < 2 ? "tutorial-rank tutorial-enemy-rank" : "tutorial-rank"} key={rank}>
            <span>{rank}</span>
            <div><i /><i /><i /></div>
          </div>
        ))}
      </div>
      <TutorialDialogue lines={introduction} audio={audio} actionLabel="Draw five cards" onDone={onDeal} onExit={onExit} />
    </main>
  );
}

export const tutorialLessons = {
  "4": [
    { speaker: "garrison", text: "Now that your cards are dealt, select the highlighted 4 in your hand. It will deploy to an empty slot in your back rank." },
    { speaker: "locke", text: "That’s the row closest to you. Try not to look too disappointed, Commander. I was listening." },
  ],
  "5": [{ speaker: "locke", text: "One soldier in place. Select the highlighted 5 and we’ll have two. I was told that counting out loud builds confidence." }],
  "6": [{ speaker: "garrison", text: "Deploy your 6 to fill the last slot. Your turn will end once your back rank is full." }],
  "move-up": [
    { speaker: "garrison", text: "All three soldiers are deployed. Select them one at a time and move them up to the front rank. All three, Locke." },
    { speaker: "locke", text: "Hold on! Let’s be sneaky. Your 6 of Hearts can attack the enemy front rank from behind our lines. Move up the 5 and the 4, and leave the 6 in the back." },
  ],
  "attack": [
    { speaker: "locke", text: "Time to attack. Select a front-rank number card or your 6 of Hearts in the back rank, then choose an enemy target. Attacking usually ends your turn." },
    { speaker: "garrison", text: "Check the Weapon Triangle before you strike. In Easy mode, you’ll get a warning if a face-up target is immune." },
  ],
} satisfies Record<string, readonly DialogueLine[]>;

export function TutorialBattleDialogue({ lesson, audio, onDone }: {
  lesson: keyof typeof tutorialLessons;
  audio: AudioContext | null;
  onDone: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="tutorial-battle-dialog" aria-labelledby="tutorial-title"
      onCancel={event => { event.preventDefault(); }}>
      <TutorialDialogue lines={tutorialLessons[lesson]} audio={audio} actionLabel="Resume match" onDone={onDone} />
    </dialog>
  );
}

function TutorialDialogue({ lines, audio, actionLabel, onDone, onExit }: {
  lines: readonly DialogueLine[];
  audio: AudioContext | null;
  actionLabel: string;
  onDone: () => void;
  onExit?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const { speaker, text } = lines[index];
  const last = index === lines.length - 1;
  const [visibleLength, setVisibleLength] = useState(0);
  const [sound, setSound] = useState(true);
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const onBackground = useCallback(() => {}, []);
  const { canPlayAudio } = useAudioForeground(onBackground);
  const typing = !reducedMotion && visibleLength < text.length;

  useEffect(() => {
    if (!typing) return;
    const timer = window.setTimeout(() => {
      const character = text[visibleLength];
      if (sound && audio && canPlayAudio() && visibleLength % 2 === 0 && character.trim()) {
        playTypingTick(audio, speaker === "garrison");
      }
      setVisibleLength(visibleLength + 1);
    }, 23);
    return () => window.clearTimeout(timer);
  }, [audio, canPlayAudio, sound, speaker, text, typing, visibleLength]);

  function previous() {
    if (index === 0) return;
    setVisibleLength(0);
    setIndex(index - 1);
  }

  function next() {
    if (typing) {
      setVisibleLength(text.length);
    } else if (last) {
      onDone();
    } else {
      setVisibleLength(0);
      setIndex(index + 1);
    }
  }

  return (
      <section className="tutorial-overlay" role={onExit ? "dialog" : undefined} aria-modal={onExit ? true : undefined} aria-labelledby={onExit ? "tutorial-title" : undefined}
        onKeyDown={event => {
          if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
          if (event.key === "ArrowRight" && (!last || typing)) { event.preventDefault(); next(); }
        }}>
        <div className="tutorial-scene">
          <h1 id="tutorial-title">Tutorial</h1>
          <div className="tutorial-portraits" aria-hidden="true">
            {(["locke", "garrison"] as const).map(key => (
              <div key={key} className={`tutorial-portrait tutorial-portrait-${key}`} data-speaking={speaker === key}>
                <img src={`${import.meta.env.BASE_URL}tutorial/${advisors[key].image}`} alt="" />
              </div>
            ))}
          </div>
          <div className="tutorial-dialogue" data-speaker={speaker}>
            <div aria-live="polite" aria-atomic="true">
              <h2>{advisors[speaker].name}</h2>
              <p className="tutorial-line">
                <span className="tutorial-line-spacer" aria-hidden="true">{text}</span>
                <span aria-hidden="true">{typing ? text.slice(0, visibleLength) : text}</span>
                <span className="tutorial-line-accessible">{text}</span>
              </p>
            </div>
            <div className="tutorial-controls">
              {audio && <button type="button" className="playtest-button" aria-pressed={sound}
                onClick={() => setSound(current => !current)}>Typing sound {sound ? "on" : "off"}</button>}
              {onExit && <button type="button" className="playtest-button" onClick={onExit}>Exit tutorial</button>}
              <button type="button" className="playtest-button" disabled={index === 0} onClick={previous}>Back</button>
              <button type="button" className="playtest-button tutorial-next" autoFocus onClick={next}>
                {typing ? "Show full line" : last ? actionLabel : "Next"}
              </button>
            </div>
          </div>
        </div>
      </section>
  );
}
