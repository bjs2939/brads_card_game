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
  tone.type = "square";
  tone.frequency.setValueAtTime(lowerPitch ? 235 : 340, start);
  tone.frequency.exponentialRampToValueAtTime(lowerPitch ? 145 : 190, start + 0.022);
  volume.gain.setValueAtTime(0.04, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.025);
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
  "enemy-opening": [
    { speaker: "garrison", text: "Your back rank is full. It’s the opponent’s turn now. They’ll draw and deploy their units while you wait." },
    { speaker: "locke", text: "Give the computer a few seconds to make its moves. Even the enemy needs time to get organized, apparently." },
  ],
  "move-up": [
    { speaker: "garrison", text: "All three soldiers are deployed. Select them one at a time and move them up to the front rank. All three, Locke." },
    { speaker: "locke", text: "Hold on! Let’s be sneaky. Your 6 of Hearts can attack the enemy front rank from behind our lines. Move up the 5 and the 4, and leave the 6 in the back." },
  ],
  "cover": [
    { speaker: "garrison", text: "The 4 and 5 are in place. Rearranging cards within the same rank is a free action. You can do it without ending your turn." },
    { speaker: "locke", text: "Put the 6 behind the 4 or the 5 for cover. Drag it into an empty slot in the back rank, or select the 6 and then select the slot." },
  ],
  "attack": [
    { speaker: "garrison", text: "The 6 has cover. Time to attack. Their left card has a shield. A shield takes the hit before the soldier behind it. Leave that one alone and aim at the unshielded card in the middle of their back rank." },
    { speaker: "garrison", text: "An attack almost always ends your turn immediately. Finish moving troops or shifting shields before you strike." },
    { speaker: "locke", text: "Select your 5 of Spades in the front rank, then hit that middle card. I’m sure charging at something we can’t see will go brilliantly." },
  ],
  "counterattack": [
    { speaker: "locke", text: "Well. That was a 7 of Spades. Our 5 wasn’t strong enough, and their 7 took it out on the counterattack." },
    { speaker: "garrison", text: "That’s a normal risk. A face-down card can hide a stronger soldier. The first attack revealed it, so now you can make your next move with more information." },
    { speaker: "garrison", text: "Move Up is a reminder to check your formation. Advancing from the back rank is optional, but this is your only chance to do it this turn. Skip it wisely." },
    { speaker: "locke", text: "This time we only need to slide the 4 sideways. Same rank, free move. Try to contain your relief." },
    { speaker: "garrison", text: "Keep your 6 protected. Move the 4 sideways in the front rank until it’s directly ahead of the 6. If the 4 is already there, congratulations. You’ve anticipated an order." },
  ],
  "triangle": [
    { speaker: "locke", text: "Now for the Weapon Triangle. Hearts beat Spades, Spades beat Clubs, and Clubs beat Hearts. Diamonds stay neutral. Sensible of them, really." },
    { speaker: "garrison", text: "Hearts gain +1 power when attacking Spades. That makes your 6 of Hearts hit for 7, enough to defeat their 7 of Spades. A tie goes to the attacker." },
    { speaker: "locke", text: "And our 6 can shoot from the back rank. Select it, then select the revealed 7. This time we actually know what we’re shooting at." },
  ],
  "free-shield": [
    { speaker: "garrison", text: "That 10 of Diamonds broke your 4’s built-in shield. Every 4 gets one free shield, so it can survive a hit that would otherwise defeat it." },
    { speaker: "locke", text: "A 4 can’t hit particularly hard, but it’s excellent at stalling. Finally, a military job I’m qualified for." },
    { speaker: "garrison", text: "We’ll skip Move Up and go straight to Move Out. Deploy your 2 of Hearts. Twos are halflings, and they can defeat dragons, even a 10. Dragons can’t defeat them with a normal attack either." },
  ],
  "halfling-shield": [
    { speaker: "locke", text: "Select the Jack of Spades from your hand, then select your deployed 2 of Hearts. The Jack becomes a shield. Let’s keep our dragon slayer in one piece until it gets there." },
    { speaker: "garrison", text: "Once the shield is attached, hold your position. We’re still making preparations." },
  ],
  "deploy-reserve": [
    { speaker: "locke", text: "That 4 won’t hold much longer, and I’m not betting the castle on one halfling. Deploy your 8 of Clubs to the back rank. We’ll want a sturdier soldier ready to cover the ranger." },
  ],
  "ranger-recon": [
    { speaker: "garrison", text: "Now select the 6 of Hearts and attack the unshielded enemy on the right of their front rank. The ranger can reach it from the back rank." },
    { speaker: "locke", text: "If we take it down, lovely. If we don’t, we still reveal what it is. I call that a win with unusually flexible bookkeeping." },
  ],
  "slay-dragon": [
    { speaker: "locke", text: "This is just our day, isn’t it? An 8 of Hearts. And now the dragon’s taken our 4." },
    { speaker: "garrison", text: "Hold on, Locke. This is how battles go. We can still take out the 10. Move up the shielded 2 of Hearts, directly in front of the 6 to protect our ranger." },
  ],
  "dragon-attack": [
    { speaker: "locke", text: "The ranger has cover. Now select the 2, attack the 10 of Diamonds, and watch a halfling take down a dragon. I hope someone is writing this down." },
  ],
  "reserve-move-up": [
    { speaker: "garrison", text: "The dragon is down. Move your 8 of Clubs to the front rank. It’s time to deal with that 8 of Hearts the ranger uncovered." },
    { speaker: "locke", text: "I see the 10 of Clubs in your hand. Keep the dragon in reserve for now. We still don’t know what they’re holding or how they’ll use it. Even I don’t show my best trick first." },
  ],
  "transfer-shield": [
    { speaker: "locke", text: "Our halfling’s luck can’t last forever. Let’s move the Jack of Spades shield from the 2 to the 8 of Clubs. I’d rather give our stronger soldier a chance to stick around." },
    { speaker: "garrison", text: "Either player can reallocate shields between cards on their field before attacking. It’s a free move. Select the shielded 2, then select the 8 to transfer the Jack." },
  ],
  "reserve-attack": [
    { speaker: "garrison", text: "Select the 8 of Clubs, then attack the revealed 8 of Hearts. Clubs beat Hearts, so your 8 gets +1." },
    { speaker: "locke", text: "Nine beats eight. Where was this arithmetic when I was doing community service paperwork?" },
  ],
  "break-queen-shield": [
    { speaker: "locke", text: "Did their 3 of Clubs really just attack our 8? Bold strategy. I assume the strategy was to lose a turn." },
    { speaker: "garrison", text: "Easy opponents sometimes waste attacks. A weaker card usually can’t defeat a stronger one, so check your power and suit before committing." },
    { speaker: "locke", text: "Normally Hearts can’t hit Clubs. But that shield has its own suit, and that’s what our ranger will attack first. Select the 6 of Hearts, then target the shielded 3." },
  ],
  "take-out-three": [
    { speaker: "garrison", text: "The shield was a Queen of Diamonds. Diamonds are neutral, so the ranger broke it. The 3 of Clubs is exposed now." },
    { speaker: "locke", text: "Send our 8 of Clubs against the 3. Same suit, higher power. See? We learn from other people’s bad ideas." },
  ],
  "press-the-advantage": [
    { speaker: "locke", text: "Now their 4 tried attacking our 8. I’m beginning to think the enemy commander owes someone community service too." },
    { speaker: "garrison", text: "A Jack or Queen shield borrows the strength of the card it protects. Put one on an 8 and the shield has 8 power. It still uses its own suit, so their 4 never had the strength to break it." },
    { speaker: "garrison", text: "Our line is strong enough for now. Keep the rest of your troops in hand and chip away with the cards already on the field." },
    { speaker: "locke", text: "Then let’s try our 8 of Clubs against that pesky 4 of Spades. Go on, select the 8 and aim at the 4." },
  ],
  "clubs-immunity": [
    { speaker: "garrison", text: "Hold it, you idiot. Clubs can’t hit Spades. The 4 would block the attack and we’d waste our turn." },
    { speaker: "locke", text: "I was testing you, obviously. Select our 6 of Hearts and aim at the 4 instead. The ranger can keep shooting from the back rank." },
  ],
  "replace-cover": [
    { speaker: "garrison", text: "As expected, their 5 took out the halfling. Slide your 8 of Clubs directly in front of the 6 to defend it. Select the 8, then the empty front-rank slot ahead of the ranger." },
    { speaker: "locke", text: "The ranger gets a new bodyguard. Now let the 6 take another shot at the 4 of Spades. Its free shield is already gone." },
  ],
  "hearts-break-shield": [
    { speaker: "locke", text: "Their 7 of Hearts just broke the Jack of Spades. Our 8 is still standing. I’d say the Jack did its job, if it were around to hear me." },
    { speaker: "garrison", text: "Hearts beat Spades. The 7 gained +1 against the shield, reaching its strength of 8. The shield absorbed the hit, so the 8 of Clubs survives." },
    { speaker: "locke", text: "A 7 of Spades would block our Clubs attack, but this is Hearts. Select your 8 of Clubs and take out their 7 of Hearts." },
  ],
  "reinforce": [
    { speaker: "locke", text: "Their 9♠ just took out our 8♣. I’d complain about the odds, but nine is, regrettably, bigger than eight." },
    { speaker: "garrison", text: "We need more firepower. Deploy your 8♠ and 9♥ to the back rank. They’ll be ready to advance next turn." },
  ],
  "ranger-immunity": [
    { speaker: "garrison", text: "A card in the back rank can’t attack unless it’s a 6. Select our ranger and aim at the shield on their 5♦. Remember: the shield has its own suit." },
    { speaker: "locke", text: "And it’s face down. Very considerate of the enemy to keep their paperwork private." },
  ],
  "threes-stack": [
    { speaker: "locke", text: "That shield was Clubs, so our Hearts shot bounced. Then two 3s teamed up and took out our 6. I object to teamwork when it’s theirs." },
    { speaker: "garrison", text: "Think of two little soldiers pushing together. A 3 and another 3 make 6 power. Matching ranks from 2 to 7 can stack. Each card checks its own suit first, then you add what’s left. Six power ties our 6, and the attacker wins ties." },
    { speaker: "locke", text: "Our ranger has been defeated by addition. Move up the 9♥ and 8♠. Let’s try subtraction." },
  ],
  "keep-the-ranks-ready": [
    { speaker: "garrison", text: "Deploy the 10♣ and 4♦ to the back rank. Keep enough troops ready to replace losses. You can leave slots open when that suits your plan." },
  ],
  "nine-versus-nine": [
    { speaker: "locke", text: "Their 9♠ against our 9♥. Two nines walk into a battlefield. One has read the Weapon Triangle." },
    { speaker: "garrison", text: "Hearts beat Spades, Spades beat Clubs, Clubs beat Hearts. Diamonds are neutral. Our 9♥ gains +1 here, so it hits for 10. Select it and attack the 9♠." },
  ],
  "health-stats": [
    { speaker: "garrison", text: "Look at Match Details. You have 13 cards, the opponent has 10, and 17 remain in the draw deck. Player and Opponent Health count the cards in each hand and on the battlefield, including attached shields." },
    { speaker: "locke", text: "More cards usually means more ways to attack or answer an attack. Thirteen against ten is a good sign, though I’ve lost bets with better odds." },
  ],
  "attack-shielded-stack": [
    { speaker: "garrison", text: "Our line is strong. Select the 9♥ and attack that stack of 3s. It has a shield, so the first hit goes to the shield." },
    { speaker: "locke", text: "Two soldiers hiding behind borrowed equipment. I respect the approach. I still want it gone." },
  ],
  "clear-the-stack": [
    { speaker: "locke", text: "Shield’s gone. Those two 3s are still standing shoulder to shoulder. How touching." },
    { speaker: "garrison", text: "Stacks combine power when they attack, but grouping up has a cost. If your attack reaches the combined defense of multiple cards it can hit, they can all go down together." },
    { speaker: "locke", text: "Two 3s make 6. Our 9♥ has enough power to take out both. Select the 9 and hit the exposed stack." },
  ],
  "blind-nine": [
    { speaker: "locke", text: "I’m feeling lucky. Select our 9♥ and attack their face-down middle card in the front rank. What’s the worst it could be?" },
    { speaker: "garrison", text: "I could draw you up a list, but I suspect we’re about to get a demonstration." },
  ],
  "raise-dragon": [
    { speaker: "locke", text: "A 10♥. And it took out our 9♥. I apologize for my extremely confident miscalculation." },
    { speaker: "garrison", text: "You’re not completely out of luck. We kept our 10♣ in reserve. Move it up to the front rank." },
  ],
  "shield-dragon": [
    { speaker: "garrison", text: "Before attacking, select the J♦ from your hand and attach it to the 10♣. We’d like to keep our strongest card around longer than your last prediction." },
  ],
  "queen-double": [
    { speaker: "locke", text: "Queens have another trick. You can discard one to attack twice in the same turn. Select a Queen from your hand, then press Double Attack." },
    { speaker: "garrison", text: "Use your shielded 10♣ against the 10♥ first. Then select the 10♣ again and attack the J♣ shield on the 5♦. One turn, two cards taken out." },
  ],
  "ten-cards-left": [
    { speaker: "locke", text: "Ten cards left? Commander, what’s happening? Has someone been stealing from the deck? I’d appreciate it if you’d look at someone else." },
    { speaker: "garrison", text: "A low deck means the match is entering its final stretch. Once it runs out, you’ll have to make do with the cards you have. These turns can change who wins, so choose your attacks carefully." },
  ],
  "joker-deploy": [
    { speaker: "garrison", text: "You drew a Joker. It can’t attack. Leave it face down and let an enemy spring the trap. An attacker normally goes down with the Joker." },
    { speaker: "locke", text: "Except 5s. They’re combat engineers, and they’re immune to the blast. Apparently someone read the safety manual." },
    { speaker: "garrison", text: "Deploy the Joker to your back rank. Then we’ll deal with the enemy 5♦ before it gets any ideas." },
  ],
  "move-joker-up": [
    { speaker: "garrison", text: "First, select the red Joker in your back rank. Move it up to fill the gap our nine left in the front rank." },
    { speaker: "locke", text: "A face-down trap on the front line. Finally, a plan that sounds like community service." },
  ],
  "replace-lost-nine": [
    { speaker: "locke", text: "I still miss our 9♥. I was getting used to a plan that involved somebody else getting hit." },
    { speaker: "garrison", text: "We lost it to their dragon. Deploy your second Joker to the back rank. Let the enemy take a chance this time." },
  ],
  "attack-enemy-ranger": [
    { speaker: "garrison", text: "Their 6♣ has range. Select your 8♠ or 10♣, then attack the 6♣. That ends your turn." },
    { speaker: "locke", text: "Either one works? This is the sort of decision I was born to make." },
  ],
  "protect-the-joker": [
    { speaker: "locke", text: "The Joker’s in place. Use either your 8♠ or your 10♣ to take out the exposed 5♦. We don’t need the enemy sending a bomb disposal crew." },
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
    <dialog ref={dialog} className="tutorial-battle-dialog" data-lesson={lesson} aria-labelledby="tutorial-title"
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
      if (sound && audio && canPlayAudio() && character.trim()) {
        playTypingTick(audio, speaker === "garrison");
      }
      setVisibleLength(visibleLength + 1);
    }, 31);
    return () => window.clearTimeout(timer);
  }, [audio, canPlayAudio, sound, speaker, text, typing, visibleLength]);

  function resumeTypingAudio() {
    if (sound && audio?.state === "suspended" && canPlayAudio()) void audio.resume().catch(() => {});
  }

  function previous() {
    resumeTypingAudio();
    if (index === 0) return;
    setVisibleLength(0);
    setIndex(index - 1);
  }

  function next() {
    resumeTypingAudio();
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
          if (event.key === " ") {
            event.preventDefault();
            if (!event.repeat) next();
            return;
          }
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
