import { useState } from "react";
import "./TutorialIntro.css";

const advisors = {
  locke: { name: "Locke", image: "locke.png" },
  garrison: { name: "Commander Garrison", image: "garrison.png" },
};

const introduction = [
  { speaker: "locke", text: "Name’s Locke. I’m a thief, and I got caught. Now I owe the town some community service. Turns out that means teaching you how to play cards." },
  { speaker: "garrison", text: "Commander Garrison. I’m here to make sure Locke teaches you the rules correctly. We’ll start with an empty battlefield and a shared deck." },
  { speaker: "locke", text: "First, we each draw five cards. You can look at your own hand, but your opponent’s cards stay face down. No peeking. Yes, Commander, that includes me." },
  { speaker: "garrison", text: "Once both hands are dealt, you’ll take the first turn. Ready? Draw your opening five cards." },
] as const;

const ranks = ["Computer back rank", "Computer front rank", "Your front rank", "Your back rank"];

export default function TutorialIntro({ onDeal, onExit }: { onDeal: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const { speaker, text } = introduction[index];
  const last = index === introduction.length - 1;

  function previous() {
    setIndex(current => Math.max(0, current - 1));
  }

  function next() {
    if (last) onDeal();
    else setIndex(current => Math.min(introduction.length - 1, current + 1));
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
          if (event.key === "ArrowRight" && !last) { event.preventDefault(); next(); }
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
              <p>{text}</p>
            </div>
            <div className="tutorial-controls">
              <button type="button" className="playtest-button" onClick={onExit}>Exit tutorial</button>
              <button type="button" className="playtest-button" disabled={index === 0} onClick={previous}>Back</button>
              <button type="button" className="playtest-button tutorial-next" autoFocus onClick={next}>
                {last ? "Draw five cards" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
