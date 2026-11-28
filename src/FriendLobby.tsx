import { useEffect, useState } from "react";
import MatchCoin, { COIN_FLIP_MS } from "./MatchCoin";
import type { Card } from "./game_engine/types";

import type { Field, ShieldLayer, TurnStep, Unit, Game } from "./game_engine/battle";

export type FriendAction = "deploy" | "shield" | "end-turn" | "next" | "promote" | "rearrange" | "stack-hand" | "stack-field" | "attack" | "convert" | "special" | "castle" | "retreat" | "collect" | "undo" | "transfer" | "drop-field" | "swap-field" | "unstack" | "shield-ability";
type EnemyUnit = Omit<Unit, "card" | "shields"> & { card?: Card; shields?: { card?: Card; revealed: boolean }[] };
type FriendBattleView = { spy?: { card: Card; at: number }; doubleAttack?: 1 | 2; jokerExplosion?: NonNullable<Game["jokerExplosion"]> & { at: number }; undoCount?: number; completedAttack?: { turn: number; byYou: boolean }; attack?: NonNullable<Game["attackAnimation"]> & { at: number }; recoveredDiscard?: Game["recoveredDiscard"]; recovery?: boolean; ownField?: Field; enemyField?: (EnemyUnit | null)[]; step?: TurnStep; active?: boolean; discardPile?: Card[]; result?: string; outcome?: "victory" | "defeat" | "draw" };
type FirstTurn = "flip" | "host" | "guest";
export type FriendOpeningView = FriendBattleView & { hand: Card[]; opponentCardCount: number; deckCount: number; goesFirst: boolean; opponentName: string; code: string; turn: number; revision: number; canAct: boolean; deployed: Card[]; opponentDeployed: number; shields?: ShieldLayer[][]; opponentShieldCounts?: number[]; ownField?: Field; active?: boolean };
type Room = {
  code: string;
  seat: "host" | "guest";
  ready: boolean;
  opening?: FriendBattleView & { firstSeat: "host" | "guest"; hand: Card[]; opponentCardCount: number; deckCount: number; turn: number; revision: number; deployed?: Card[]; opponentDeployed?: number; shields?: ShieldLayer[][]; opponentShieldCounts?: number[]; ownField?: Field; active?: boolean };
  hostName: string;
  guestName?: string;
  settings: { firstTurn: FirstTurn; jokers: number; timer: boolean };
};

const endpoint = "/api/friend-rooms";
const firstTurns = { flip: "Coin flip", host: "Host", guest: "Friend" };

export function inviteCode() {
  return /^#friend=([a-f\d]{16})$/i.exec(window.location.hash)?.[1].toUpperCase() ?? "";
}

const lastRoomKey = "brads-card-game:last-friend-match";

function roomToken(code: string) {
  const key = "friend-room:" + code;
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

function rememberRoom(code: string, token: string, replace = false) {
  const key = "friend-room:" + code;
  sessionStorage.setItem(key, token);
  if (replace || !localStorage.getItem(key)) localStorage.setItem(key, token);
}

export function resumableFriendCode() {
  const code = sessionStorage.getItem(lastRoomKey) ?? localStorage.getItem(lastRoomKey) ?? "";
  return /^[A-F0-9]{16}$/.test(code) && roomToken(code) ? code : "";
}

async function roomRequest(path: string, options?: RequestInit) {
  const response = await fetch(endpoint + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function matchView(room: Room): FriendOpeningView | undefined {
  if (!room.opening) return;
  const { firstSeat, ...opening } = room.opening;
  const goesFirst = firstSeat === room.seat;
  return { ...opening, deployed: opening.deployed ?? [], opponentDeployed: opening.opponentDeployed ?? 0, code: room.code, goesFirst,
    canAct: opening.active ?? (opening.turn === (goesFirst ? 1 : 2)),
    opponentName: (room.seat === "host" ? room.guestName : room.hostName) ?? "Opponent" };
}

export async function syncFriendMatch(code: string, move?: { action: FriendAction; index?: number; target?: number; shieldIndex?: number; revision: number }) {
  const token = roomToken(code);
  const headers = { Authorization: "Bearer " + token };
  const room = await roomRequest("/" + code + (move ? "/move" : ""), move ? {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(move),
  } : { headers });
  if (token) rememberRoom(code, token);
  return matchView(room);
}

export default function FriendLobby({ playerName, onMatch }: { playerName: string; onMatch: (opening: FriendOpeningView) => void }) {
  const [code, setCode] = useState(inviteCode);
  const [room, setRoom] = useState<Room>();
  const [firstTurn, setFirstTurn] = useState<FirstTurn>("flip");
  const [jokers, setJokers] = useState(4);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const activeCode = room?.code ?? code.trim().toUpperCase();
  const validCode = /^[A-F0-9]{16}$/.test(activeCode);

  useEffect(() => {
    if (!validCode || busy) return;
    const token = roomToken(activeCode);
    if (!token) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const next = await roomRequest("/" + activeCode, {
          headers: { Authorization: "Bearer " + token }, signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          rememberRoom(activeCode, token);
          setMessage("");
          setRoom(next);
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Room unavailable.");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [activeCode, validCode, busy]);

  const [shownFlip, setShownFlip] = useState("");
  const [landedFlip, setLandedFlip] = useState("");
  const flipKey = room?.opening?.turn === 1 && room.settings.firstTurn === "flip"
    ? "friend-coin:" + room.code : "";
  const showingFlip = !!flipKey && shownFlip !== flipKey && !sessionStorage.getItem(flipKey);

  useEffect(() => {
    if (!showingFlip) return;
    const landing = window.setTimeout(() => setLandedFlip(flipKey), COIN_FLIP_MS);
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(flipKey, "shown");
      setShownFlip(flipKey);
    }, COIN_FLIP_MS + 650);
    return () => { window.clearTimeout(landing); window.clearTimeout(timer); };
  }, [flipKey, showingFlip]);

  useEffect(() => {
    const opening = room && matchView(room);
    if (opening && !showingFlip) {
      sessionStorage.setItem(lastRoomKey, opening.code);
      localStorage.setItem(lastRoomKey, opening.code);
      onMatch(opening);
    }
  }, [room, onMatch, showingFlip]);

  async function enter(join: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const { token, ...next } = await roomRequest(join ? "/" + activeCode + "/join" : "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(join ? { name: playerName } : { name: playerName, firstTurn, jokers }),
      });
      rememberRoom(next.code, token, true);
      const url = new URL(window.location.href);
      url.hash = "friend=" + next.code;
      history.replaceState(null, "", url);
      setRoom(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    if (!room || room.seat !== "host") return;
    const token = roomToken(activeCode);
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await roomRequest("/" + room.code, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ firstTurn, jokers }),
      });
      setRoom(next);
      setEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function startMatch() {
    if (!room?.ready || room.seat !== "host") return;
    const token = roomToken(activeCode);
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      setRoom(await roomRequest("/" + room.code + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: "{}",
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the match.");
    } finally {
      setBusy(false);
    }
  }

  const settingsFields = (
    <>
          <label>First turn <select value={firstTurn} onChange={event => setFirstTurn(event.target.value as FirstTurn)}>
            {Object.entries(firstTurns).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Jokers <select value={jokers} onChange={event => setJokers(Number(event.target.value))}>
            {[0, 1, 2, 3, 4].map(count => <option key={count} value={count}>{count === 4 ? "4 (Recommended)" : count}</option>)}
          </select></label>
    </>
  );

  const invite = new URL(window.location.href);
  if (room) invite.hash = "friend=" + room.code;

  return (
    <div className="friend-lobby">
      {showingFlip && room?.opening ? (
        <div className="match-coin-area">
          <MatchCoin flipping={landedFlip !== flipKey} tails={room.opening.firstSeat === "guest"} />
          <p className="match-setup-result" role="status">{landedFlip !== flipKey ? "Flipping coin…" : room.opening.firstSeat === room.seat ? "You go first." : "Your friend goes first."}</p>
        </div>
      ) : room ? (
        <>
          <p>{room.ready ? "Both players joined." : "Waiting for your friend to join…"}</p>
          {!room.ready && room.seat === "host" && <button type="button" disabled={busy}
            onClick={() => void enter(true)}>Join as Guest in This Tab</button>}
          <p>Host: {room.hostName}{room.guestName && <> · Guest: {room.guestName}</>}</p>
          <p>You are the {room.seat === "host" ? "host" : "guest"}. First turn: {firstTurns[room.settings.firstTurn]}. Jokers: {room.settings.jokers}. Timer off.</p>
          <label>Room code <input readOnly value={room.code} /></label>
          <button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(invite.href); setMessage("Invite link copied."); }
            catch { setMessage("Copy the room code above to invite your friend."); }
          }}>Copy Invite Link</button>
          {room.seat === "host" && (editing ? (
            <form className="friend-lobby" onSubmit={event => { event.preventDefault(); void saveSettings(); }}>
              {settingsFields}
              <button type="submit" disabled={busy}>Save Settings</button>
              <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel Edit</button>
            </form>
          ) : (
            <button type="button" onClick={() => {
              setFirstTurn(room.settings.firstTurn);
              setJokers(room.settings.jokers);
              setMessage("");
              setEditing(true);
            }}>Edit Settings</button>
          ))}
          {room.ready && (room.seat === "host" ? (
            <button type="button" disabled={busy || editing} onClick={() => void startMatch()}>Start Match</button>
          ) : <p>Waiting for the host to start the match.</p>)}
        </>
      ) : (
        <>
          {settingsFields}
          <button type="button" disabled={busy} onClick={() => void enter(false)}>Create Room</button>
          <label>Room code <input value={code} onChange={event => setCode(event.target.value)} maxLength={16} /></label>
          <button type="button" disabled={busy || !validCode} onClick={() => void enter(true)}>Join Room</button>
        </>
      )}
      <div role="status">{message}</div>
    </div>
  );
}
