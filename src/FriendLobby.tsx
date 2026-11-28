import { useEffect, useState } from "react";
import type { Card } from "./game_engine/types";

type FirstTurn = "flip" | "host" | "guest";
export type FriendOpeningView = { hand: Card[]; opponentCardCount: number; deckCount: number; goesFirst: boolean; opponentName: string; code: string; turn: number; revision: number; canAct: boolean; deployed: Card[]; opponentDeployed: number };
type Room = {
  code: string;
  seat: "host" | "guest";
  ready: boolean;
  opening?: { firstSeat: "host" | "guest"; hand: Card[]; opponentCardCount: number; deckCount: number; turn: number; revision: number; deployed: Card[]; opponentDeployed: number };
  hostName: string;
  guestName?: string;
  settings: { firstTurn: FirstTurn; jokers: number; timer: boolean };
};

const endpoint = "/api/friend-rooms";
const firstTurns = { flip: "Coin flip", host: "Host", guest: "Friend" };

export function inviteCode() {
  return /^#friend=([a-f\d]{16})$/i.exec(window.location.hash)?.[1].toUpperCase() ?? "";
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
  return { ...opening, code: room.code, goesFirst,
    canAct: opening.turn === (goesFirst ? 1 : 2),
    opponentName: (room.seat === "host" ? room.guestName : room.hostName) ?? "Opponent" };
}

export async function syncFriendMatch(code: string, move?: { action: "deploy" | "end-turn"; index?: number; revision: number }) {
  const token = sessionStorage.getItem("friend-room:" + code);
  const headers = { Authorization: "Bearer " + token };
  return matchView(await roomRequest("/" + code + (move ? "/move" : ""), move ? {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(move),
  } : { headers }));
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
  const credentialKey = "friend-room:" + activeCode;

  useEffect(() => {
    if (!validCode || busy) return;
    const token = sessionStorage.getItem(credentialKey);
    if (!token) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const next = await roomRequest("/" + activeCode, {
          headers: { Authorization: "Bearer " + token }, signal: controller.signal,
        });
        if (!controller.signal.aborted) setRoom(next);
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Room unavailable.");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [activeCode, credentialKey, validCode, busy]);

  useEffect(() => {
    const opening = room && matchView(room);
    if (opening) onMatch(opening);
  }, [room, onMatch]);

  async function enter(join: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const { token, ...next } = await roomRequest(join ? "/" + activeCode + "/join" : "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(join ? { name: playerName } : { name: playerName, firstTurn, jokers }),
      });
      sessionStorage.setItem("friend-room:" + next.code, token);
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
    const token = sessionStorage.getItem(credentialKey);
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
    const token = sessionStorage.getItem(credentialKey);
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
      {room ? (
        <>
          <p>{room.ready ? "Both players joined." : "Waiting for your friend to join…"}</p>
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
