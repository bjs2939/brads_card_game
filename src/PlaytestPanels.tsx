import { useRef, useState } from "react";
import "./PlaytestPanels.css";
import { createFeedbackIssue, feedbackCategories, gameVersion, loadHistory } from "./playtest";

export function Feedback({ context, floating = false, onOpenChange }: {
  context: string;
  floating?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<string>(feedbackCategories[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [diagnostics, setDiagnostics] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const requestId = useRef("");
  const feedbackEndpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  const [preview, setPreview] = useState<ReturnType<typeof createFeedbackIssue>>();
  const [status, setStatus] = useState("");

  return <>
    <button type="button" className={floating ? "playtest-button feedback-floating" : "playtest-button"}
      aria-haspopup="dialog" onClick={() => { dialog.current?.showModal(); onOpenChange?.(true); }}>
      <span aria-hidden="true">&#9993;</span> Feedback
    </button>
    <dialog ref={dialog} className="game-mode-picker playtest-dialog" aria-labelledby="feedback-title"
      onClose={() => onOpenChange?.(false)}>
      <h2 id="feedback-title">Help improve the game</h2>
      <p>Your name and email are stored privately so the developer can reply. The report below will be public on GitHub. Keep personal details out of the subject and description.</p>
      {preview ? <>
        <h3>Review your public report</h3>
        <p><strong>{preview.title}</strong></p>
        <pre>{preview.body}</pre>
        <div className="playtest-actions">
          <button type="button" disabled={sending || !feedbackEndpoint} onClick={async () => {
            setSending(true);
            setStatus("Sending feedback…");
            try {
              const response = await fetch(feedbackEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: requestId.current, name, email, category, subject, description, context: diagnostics ? context : undefined }),
              });
              const result = await response.json();
              if (!response.ok || !Number.isSafeInteger(result.issue)) throw new Error("Submission failed");
              setPreview(undefined);
              setName("");
              setEmail("");
              setSubject("");
              setDescription("");
              setDiagnostics(false);
              setStatus(`Feedback sent. Reference #${result.issue}.`);
            } catch {
              setStatus("Feedback could not be sent. Your report is still here. Please try again.");
            } finally {
              setSending(false);
            }
          }}>{sending ? "Sending…" : "Send feedback"}</button>
          <button type="button" disabled={sending} onClick={() => { setPreview(undefined); setStatus(""); }}>Edit report</button>
        </div>
        <p role="status">{feedbackEndpoint ? status : "Direct feedback is awaiting server setup."}</p>
      </> : <form onSubmit={event => {
        event.preventDefault();
        if (!name.trim() || !subject.trim() || !description.trim()) { setStatus("Complete all required fields."); return; }
        setStatus("");
        requestId.current = crypto.randomUUID();
        setPreview(createFeedbackIssue(category, subject, description, diagnostics ? context : undefined, name.trim()));
      }}>
        <label>Category<select value={category} onChange={event => setCategory(event.currentTarget.value)}>
          {feedbackCategories.map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label>Name<input required autoComplete="name" maxLength={100} value={name} onChange={event => setName(event.currentTarget.value)} /></label>
        <label>Return email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.currentTarget.value)} /></label>
        <label>Subject<input required maxLength={100} value={subject} onChange={event => setSubject(event.currentTarget.value)} /></label>
        <label>Description<textarea required maxLength={1500} rows={5} value={description}
          onChange={event => setDescription(event.currentTarget.value)} /></label>
        <label className="playtest-check"><input type="checkbox" checked={diagnostics}
          onChange={event => setDiagnostics(event.currentTarget.checked)} /> Include game version and match summary</label>
        <button type="submit">Preview report</button>
        <p role="status">{status}</p>
      </form>}
      <button type="button" onClick={() => dialog.current?.close()}>Close</button>
    </dialog>
  </>;
}

export function MatchHistory() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [matches, setMatches] = useState(loadHistory);
  return <>
    <button type="button" className="playtest-button" onClick={() => {
      setMatches(loadHistory());
      dialog.current?.showModal();
    }}>Match History</button>
    <dialog ref={dialog} className="game-mode-picker playtest-dialog" aria-labelledby="history-title">
      <h2 id="history-title">Match History</h2>
      <p>Recent matches saved in this browser.</p>
      {!matches.length && <p>No saved matches yet.</p>}
      {matches.map(match => <details key={match.id}>
        <summary>{match.difficulty} &#183; {new Date(match.at).toLocaleString()} &#183; {match.result}</summary>
        <ol>{match.lines.map((line, i) => <li key={i}>{line}</li>)}</ol>
      </details>)}
      <button type="button" onClick={() => dialog.current?.close()}>Close</button>
    </dialog>
  </>;
}

export { gameVersion };
