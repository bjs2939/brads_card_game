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
      <p>Reports posted on GitHub are public. Leave out contact details and review any screenshot before attaching it on GitHub.</p>
      {preview ? <>
        <h3>Review your report</h3>
        <p><strong>{preview.title}</strong></p>
        <pre>{preview.body}</pre>
        {preview.needsCopy && <p>Copy your report, then paste it into GitHub.</p>}
        <div className="playtest-actions">
          <button type="button" onClick={() => {
            if (!navigator.clipboard) { setStatus("You can select and copy the preview text."); return; }
            void navigator.clipboard.writeText(preview.body).then(() => setStatus("Report copied."),
              () => setStatus("Copy failed. You can select and copy the preview text."));
          }}>Copy report</button>
          <a href={preview.url} target="_blank" rel="noopener noreferrer">Continue to GitHub</a>
          <button type="button" onClick={() => { setPreview(undefined); setStatus(""); }}>Edit report</button>
        </div>
        <p role="status">{status}</p>
      </> : <form onSubmit={event => {
        event.preventDefault();
        if (!subject.trim() || !description.trim()) { setStatus("Enter both a subject and a description."); return; }
        setStatus("");
        setPreview(createFeedbackIssue(category, subject, description, diagnostics ? context : undefined));
      }}>
        <label>Category<select value={category} onChange={event => setCategory(event.currentTarget.value)}>
          {feedbackCategories.map(value => <option key={value}>{value}</option>)}
        </select></label>
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
