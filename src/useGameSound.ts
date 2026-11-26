import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioForeground(onBackground: () => void) {
  const [foreground, setForeground] = useState(true);
  const pageHidden = useRef(false);
  const focused = useRef(true);
  const frozen = useRef(false);
  const canPlayAudio = useCallback(() =>
    !pageHidden.current && !frozen.current && focused.current && document.visibilityState === "visible", []);

  useEffect(() => {
    const sync = () => {
      const active = canPlayAudio();
      if (!active) onBackground();
      setForeground(active);
    };
    const hide = () => { pageHidden.current = true; sync(); };
    const show = () => { pageHidden.current = false; frozen.current = false; focused.current = true; sync(); };
    const blur = () => { focused.current = false; sync(); };
    const focus = () => { focused.current = true; sync(); };
    const freeze = () => { frozen.current = true; sync(); };
    const resume = () => { frozen.current = false; sync(); };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("freeze", freeze);
    document.addEventListener("resume", resume);
    sync();
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("freeze", freeze);
      document.removeEventListener("resume", resume);
    };
  }, [canPlayAudio, onBackground]);

  return { foreground, canPlayAudio };
}

type Tone = [frequency: number, at: number, length: number, gain: number, type?: OscillatorType, endFrequency?: number];
type Noise = [at: number, length: number, gain: number, frequency: number];
type Effect = { tones?: Tone[]; noise?: Noise[] };

const effects = {
  spy: { tones: [[330, 0, .13, .07], [523, .095, .14, .075], [660, .19, .2, .08]] },
  "deck-warning": { tones: [[660, 0, .28, .14, "triangle"], [440, .31, .28, .13, "triangle"], [660, .62, .28, .14, "triangle"], [440, .93, .28, .13, "triangle"]] },
  lightning: {
    noise: [[0, .13, .23, 4200], [.025, .28, .21, 1550], [.07, .78, .24, 450]],
    tones: [[155, .025, .34, .18, "triangle", 48], [86, .065, .67, .22, "sine", 28]],
  },
  immunity: { noise: [[0, .22, .2, 3100]], tones: [[1180, 0, .23, .12, "triangle", 415], [2080, .025, .21, .075, "triangle", 720]] },
  victory: { tones: [[262, 0, .31, .11, "triangle"], [330, .16, .32, .1, "triangle"], [392, .32, .35, .12, "triangle"], [523, .52, .75, .13, "triangle"], [659, .52, .72, .1], [784, .52, .8, .1], [1047, .9, .68, .075]], noise: [[.52, .55, .07, 3400]] },
  defeat: { tones: [[392, 0, .34, .1], [330, .24, .34, .1], [262, .48, .56, .1], [196, .65, .6, .08, "triangle"]] },
  "match-draw": { tones: [[294, 0, .35, .09], [349, .2, .4, .08], [294, .42, .55, .08]] },
  draw: { noise: [[0, .16, .12, 2200]], tones: [[460, .07, .12, .05, "sine", 690]] },
  shuffle: { noise: [[0, .09, .12, 1800], [.09, .12, .12, 2600], [.2, .13, .14, 1600]] },
  play: { noise: [[0, .08, .1, 1750]], tones: [[180, 0, .11, .11, "sine", 85]] },
  deploy: { noise: [[0, .09, .09, 1600], [.09, .09, .09, 1700]], tones: [[175, 0, .11, .08], [210, .09, .11, .08]] },
  stack: { noise: [[0, .1, .08, 2000]], tones: [[290, 0, .13, .1], [435, .065, .17, .08]] },
  shield: { tones: [[523, 0, .19, .08], [784, .06, .22, .07], [1047, .12, .25, .06]] },
  "shield-break": { noise: [[0, .19, .16, 3500]], tones: [[1230, 0, .25, .09, "triangle", 370], [1760, .05, .17, .05, "sine", 780]] },
  hit: { noise: [[0, .1, .14, 1700]], tones: [[210, 0, .16, .16, "triangle", 57]] },
  "dragon-fire": { noise: [[0,.36,.17,1250],[.11,.41,.11,720]], tones: [[125,0,.45,.11,"triangle",51]] },
  blast: { noise: [[0, .54, .26, 890], [.02, .24, .19, 3300], [.1, .86, .23, 320]], tones: [[130, 0, .46, .23, "triangle", 37], [71, .07, .75, .2, "sine", 28]] },
  block: { noise: [[0, .07, .08, 1900]], tones: [[490, 0, .18, .11, "triangle", 290]] },
  advantage: { tones: [[660, 0, .16, .09], [880, .055, .18, .08], [1320, .12, .23, .08]] },
  steal: { noise: [[0, .18, .09, 2350]], tones: [[420, 0, .15, .09, "sine", 820], [987, .12, .2, .07], [1318, .2, .21, .07]] },
  king: { noise: [[0, .2, .15, 2500]], tones: [[350, 0, .17, .12, "triangle", 80], [96, .09, .32, .15, "triangle", 38]] },
  castle: { noise: [[0, .24, .14, 750]], tones: [[150, 0, .27, .16, "triangle", 42], [83, .11, .23, .08]] },
  player: { tones: [[392, 0, .14, .06], [587, .07, .19, .055], [784, .14, .22, .05]] },
  enemy: { tones: [[220, 0, .18, .07, "triangle"], [165, .1, .23, .055, "triangle"]] },
} satisfies Record<string, Effect>;

export type GameSound = keyof typeof effects;

const recordedSounds = {
  "deck-warning": "effects/deck-warning.wav",
  lightning: "effects/thunderclap.mp3",
  immunity: "effects/immunity-crash.ogg",
  victory: "music/victory-organ.mp3",
} satisfies Partial<Record<GameSound, string>>;
type SoundState = {
  turn: number;
  drawPile: unknown[];
  drewCard: boolean;
  round: object;
  phase: string;
  sound?: { cue: GameSound; lightning?: boolean };
  advantage?: boolean;
  attackAnimation?: { kind: "ranger" | "dragon" | "card" };
  specialStrike?: unknown;
  spyFlash?: unknown;
  recoveredDiscard?: unknown;
  jokerExplosion?: unknown;
  deckWarning?: 0 | 1 | 2 | 3 | 4 | 5 | 10;
};

function playEffect(context: AudioContext, noiseBuffer: AudioBuffer, cue: GameSound,
  trackSource: (source: AudioScheduledSourceNode) => void, delay = 0) {
  const effect: Effect = effects[cue];
  const origin = context.currentTime + delay;

  function envelope(at: number, length: number, level: number) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.min(level * 1.55, 0.38), at + .012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    gain.connect(context.destination);
    return gain;
  }

  for (const [frequency, offset, length, level, type = "sine", endFrequency] of effect.tones ?? []) {
    const start = origin + offset;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
    oscillator.connect(envelope(start, length, level));
    trackSource(oscillator);
    oscillator.start(start);
    oscillator.stop(start + length);
  }

  for (const [offset, length, level, frequency] of effect.noise ?? []) {
    const start = origin + offset;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    noise.connect(filter);
    filter.connect(envelope(start, length, level));
    trackSource(noise);
    noise.start(start);
    noise.stop(start + length);
  }
}

function prepareRecording(cue: GameSound, buffer: AudioBuffer) {
  if (cue !== "lightning") return { buffer, offset: 0, level: cue === "immunity" ? 0.9 : 0.78 };

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const limit = Math.min(buffer.length, Math.floor(buffer.sampleRate * 5));
  let peak = 0;
  for (let index = 0; index < limit; index++) {
    for (const samples of channels) peak = Math.max(peak, Math.abs(samples[index]));
  }
  if (!peak) return { buffer, offset: 0, level: 1 };

  let onset = 0;
  while (onset < limit && !channels.some(samples => Math.abs(samples[onset]) >= peak * 0.24)) onset++;
  const offset = Math.max(0, onset / buffer.sampleRate - 0.035);
  let playbackPeak = 0;
  const end = Math.min(buffer.length, Math.ceil((offset + 2.15) * buffer.sampleRate));
  for (let index = Math.floor(offset * buffer.sampleRate); index < end; index++) {
    for (const samples of channels) playbackPeak = Math.max(playbackPeak, Math.abs(samples[index]));
  }
  return { buffer, offset, level: Math.min(4, 0.95 / Math.max(playbackPeak, 0.01)) };
}

export function useGameSound(game: SoundState, enabled: boolean, outcome: "victory" | "defeat" | "draw" | null, legendaryReveal?: object) {
  const audio = useRef<{ context: AudioContext; noise: AudioBuffer; recordings: Map<GameSound, ReturnType<typeof prepareRecording>> } | null>(null);
  const previousLegendaryReveal = useRef<object>();
  const activeSources = useRef(new Set<AudioScheduledSourceNode>());
  const stopEffects = useCallback(() => {
    for (const source of activeSources.current) {
      try { source.stop(); } catch { /* The source already stopped. */ }
      source.disconnect();
    }
    activeSources.current.clear();
  }, []);
  const { canPlayAudio } = useAudioForeground(stopEffects);
  const trackSource = useCallback((source: AudioScheduledSourceNode) => {
    activeSources.current.add(source);
    source.addEventListener("ended", () => {
      activeSources.current.delete(source);
      source.disconnect();
    }, { once: true });
  }, []);
  const previous = useRef(game);
  const previousOutcome = useRef(outcome);

  function unlock() {
    if (!enabled || !canPlayAudio() || !window.AudioContext) return;
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
        const recordings = new Map<GameSound, ReturnType<typeof prepareRecording>>();
        audio.current = { context, noise, recordings };
        for (const [cue, path] of Object.entries(recordedSounds) as [GameSound, string][]) {
          void fetch(`${import.meta.env.BASE_URL}assets/audio/${path}`)
            .then(response => {
              if (!response.ok) throw new Error("Audio asset unavailable");
              return response.arrayBuffer();
            })
            .then(bytes => context.decodeAudioData(bytes))
            .then(buffer => recordings.set(cue, prepareRecording(cue, buffer)))
            .catch(() => {});
        }
        playEffect(context, noise, "play", trackSource);
      }
      if (audio.current.context.state === "suspended") void audio.current.context.resume().catch(() => {});
    } catch {
      // The game remains playable when audio is unavailable.
    }
  }

  useEffect(() => {
    const legendaryStrike = legendaryReveal && legendaryReveal !== previousLegendaryReveal.current;
    previousLegendaryReveal.current = legendaryReveal;
    const old = previous.current;
    const outcomeChanged = previousOutcome.current !== outcome;
    previousOutcome.current = outcome;
    previous.current = game;
    const engine = audio.current;
    if (!enabled || !engine || !canPlayAudio()) return;

    const play = (cue: GameSound, delay = 0) => {
      const { context, noise, recordings } = engine;
      const recording = recordings.get(cue);
      if (!recording) {
        playEffect(context, noise, cue, trackSource, delay);
        return;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = recording.buffer;
      const start = context.currentTime + delay;
      const { offset, level } = recording;
      gain.gain.setValueAtTime(level, start);
      if (cue === "lightning") {
        gain.gain.setValueAtTime(level, start + 0.95);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.15);
      }
      source.connect(gain);
      gain.connect(context.destination);
      trackSource(source);
      source.start(start, offset);
      if (cue === "lightning") source.stop(start + 2.15);
    };
    const newRound = old.round !== game.round;
    const attackEffect = game.specialStrike || game.jokerExplosion || game.attackAnimation || game.spyFlash;
    const oldAttackEffect = old.specialStrike || old.jokerExplosion || old.attackAnimation || old.spyFlash;
    const combatEffect = attackEffect || game.recoveredDiscard;
    const strikeFinished = Boolean(oldAttackEffect || old.recoveredDiscard) && !combatEffect;
    if (game.recoveredDiscard && !attackEffect && (game.recoveredDiscard !== old.recoveredDiscard || oldAttackEffect)) play("draw");
    const newTurn = old.turn !== game.turn || newRound || strikeFinished;
    if (newRound) play("shuffle");
    if (legendaryStrike) play("lightning", 0.16);
    if (game.sound && game.sound !== old.sound) {
      if (game.sound.lightning) play("lightning", .08);
      if (game.attackAnimation?.kind === "dragon") play("dragon-fire", 1.1);
      play(game.sound.cue, game.attackAnimation ? game.attackAnimation.kind === "card" ? .52 : game.jokerExplosion ? 1.9 : 1.44
        : game.sound.lightning ? .27 : game.sound.cue === "immunity" ? .17 : 0);
    }
    if (combatEffect) return;
    if (game.deckWarning !== undefined && (game.deckWarning !== old.deckWarning || strikeFinished)) {
      play("deck-warning", 3.27);
    }
    if (outcome) {
      if (outcomeChanged) play(outcome === "draw" ? "match-draw" : outcome, .32);
      return;
    }
    if (game.advantage && game.sound?.cue !== "immunity" && newTurn) play("advantage", .12);
    if (newTurn) {
      play(game.phase.startsWith("computer") ? "enemy" : "player", newRound ? .2 : .18);
      if (game.drewCard && (old.drawPile !== game.drawPile || strikeFinished)) play("draw", .4);
    }
  }, [game, enabled, outcome, legendaryReveal, canPlayAudio, trackSource]);

  useEffect(() => {
    if (!enabled) stopEffects();
  }, [enabled, stopEffects]);

  useEffect(() => () => {
    stopEffects();
    const engine = audio.current;
    audio.current = null;
    if (engine) void engine.context.close().catch(() => {});
  }, [stopEffects]);

  return unlock;
}

const backgroundTracks = {
  menu: { file: "urban-theme.mp3", volume: 0.63 },
  battle: { file: "hard-battle-2.mp3", volume: 0.6 },
  "garbage-collection": { file: "heavy-boss-battle-1.mp3", volume: 0.62 },
};

type Track = keyof typeof backgroundTracks;

type MusicPlayback = { track: Track; abort: AbortController; source?: AudioBufferSourceNode };

export function useBackgroundMusic(track: Track | null) {
  const [enabled, setEnabled] = useState(false);
  const engine = useRef<{ context: AudioContext; gain: GainNode }>();
  const playback = useRef<MusicPlayback>();
  const decoded = useRef<{ track: Track; buffer: AudioBuffer }>();
  const muted = useRef(false);
  const ducked = useRef(false);
  const hasInteracted = useRef(false);

  const setDucked = useCallback((value: boolean) => {
    ducked.current = value;
    const current = playback.current;
    if (engine.current && current) {
      engine.current.gain.gain.value = backgroundTracks[current.track].volume * (value ? 0.28 : 1);
    }
  }, []);

  const stopMusic = useCallback(() => {
    const current = playback.current;
    playback.current = undefined;
    current?.abort.abort();
    if (current?.source) {
      current.source.stop();
      current.source.disconnect();
    }
    setEnabled(false);
  }, []);

  const leavePage = useCallback(() => {
    hasInteracted.current = false;
    stopMusic();
    const context = engine.current?.context;
    if (context && context.state !== "closed") void context.suspend().catch(() => {});
  }, [stopMusic]);
  const { canPlayAudio } = useAudioForeground(leavePage);

  const start = useCallback((which: Track) => {
    if (muted.current || !canPlayAudio() || !window.AudioContext || playback.current?.track === which) return;
    hasInteracted.current = true;
    stopMusic();
    if (!engine.current) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.connect(context.destination);
      engine.current = { context, gain };
    }

    const { context, gain } = engine.current;
    const current: MusicPlayback = { track: which, abort: new AbortController() };
    playback.current = current;
    const { file, volume } = backgroundTracks[which];
    const cached = decoded.current;
    if (cached?.track !== which) decoded.current = undefined;
    const ready = cached?.track === which ? Promise.resolve(cached.buffer)
      : fetch(`${import.meta.env.BASE_URL}assets/audio/music/${file}`, { signal: current.abort.signal })
          .then(response => {
            if (!response.ok) throw new Error("Music asset unavailable");
            return response.arrayBuffer();
          })
          .then(bytes => context.decodeAudioData(bytes));

    void Promise.all([context.resume(), ready]).then(([, buffer]) => {
      if (playback.current !== current) return;
      if (!canPlayAudio() || muted.current || context.state !== "running") {
        stopMusic();
        return;
      }
      decoded.current = { track: which, buffer };
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.gain.value = volume * (ducked.current ? 0.28 : 1);
      source.start();
      current.source = source;
      setEnabled(true);
    }).catch(() => {
      if (playback.current === current) stopMusic();
    });
  }, [canPlayAudio, stopMusic]);

  function toggle() {
    if (enabled) {
      muted.current = true;
      stopMusic();
    } else if (track) {
      muted.current = false;
      start(track);
    }
  }

  useEffect(() => {
    if (!track) stopMusic();
    else if (hasInteracted.current) start(track);
  }, [track, start, stopMusic]);

  useEffect(() => {
    if (!track || enabled) return;
    function unlockFromInteraction(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("[data-music-toggle]")) return;
      if (track) start(track);
    }
    document.addEventListener("click", unlockFromInteraction, true);
    return () => document.removeEventListener("click", unlockFromInteraction, true);
  }, [track, enabled, start]);

  useEffect(() => () => {
    stopMusic();
    const audio = engine.current;
    engine.current = undefined;
    decoded.current = undefined;
    if (audio) void audio.context.close().catch(() => {});
  }, [stopMusic]);

  return { enabled, toggle, start, setDucked };
}
