import { useCallback, useEffect, useState } from "react";
import { useAudioForeground } from "./useGameSound";
import "./TutorialIntro.css";

const advisors = {
  locke: { name: "Locke", image: "locke.png" },
  garrison: { name: "Commander Garrison", image: "garrison.png" },
};

const introduction = [
  { speaker: "locke", text: "Name’s Locke. Thief. I got caught, and now teaching you cards counts as community service. Apparently my other suggestion, stealing back the evidence, was a nonstarter." },
  { speaker: "garrison", text: "Commander Garrison. I was ordered to supervise. Believe me, I asked whether there was a siege I could attend instead." },
  { speaker: "locke", text: "Good news, Commander: your wish came true. The player’s castle is under attack. Leave the battlefield empty and the enemy can march right into the castle." },
  { speaker: "garrison", text: "We each start by drawing five cards. Your opponent keeps their hand face down. Once you’ve seen your hand, I’ll show you where to deploy your soldiers." },
  { speaker: "locke", text: "Five cards and one extremely enthusiastic supervisor. Try to contain your excitement, Commander." },
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

export default function TutorialIntro({ audio, onDeal, onExit }: { audio: AudioContext | null; onDeal: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const { speaker, text } = introduction[index];
  const last = index === introduction.length - 1;
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
      onDeal();
    } else {
      setVisibleLength(0);
      setIndex(index + 1);
    }
  }

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
      <section className="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"
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
              <button type="button" className="playtest-button" onClick={onExit}>Exit tutorial</button>
              <button type="button" className="playtest-button" disabled={index === 0} onClick={previous}>Back</button>
              <button type="button" className="playtest-button tutorial-next" autoFocus onClick={next}>
                {typing ? "Show full line" : last ? "Draw five cards" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
