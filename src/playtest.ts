export const gameVersion = "0.2.0";
export const feedbackCategories = [
  "Bug / Glitch", "Gameplay Improvement", "Card Balancing", "Feature Request", "Tutorial / Confusion",
  "AI Behavior", "Visual Effects", "Sound / Music", "Performance", "Dislike / Complaint", "Positive Feedback", "Other",
] as const;

export function createFeedbackIssue(category: string, subject: string, description: string, context?: string, name?: string) {
  const redactEmail = (value: string) => value.trim().replace(/[\w.!#$%&'*+/=?^_`{|}~-]+@[a-z\d.-]+\.[a-z]{2,}/gi, "[email removed]");
  const redact = (value: string) => {
    const cleaned = redactEmail(value);
    return name ? cleaned.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[name removed]") : cleaned;
  };
  const safeCategory = feedbackCategories.find(value => value === category) ?? "Other";
  const title = `[${safeCategory}] ${redact(subject)}`;
  const body = `${redact(description)}${context ? `\n\n### Optional game information\n${redact(context)}` : ""}`;
  return { title, body };
}

export type MatchRecord = { id: string; difficulty: string; at: number; result: string; lines: string[] };
const historyKey = "brads-card-game:match-history:v1";

export function loadHistory(): MatchRecord[] {
  try {
    const records: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
    if (!Array.isArray(records)) return [];
    return records.filter((record): record is MatchRecord => Boolean(record) &&
      typeof record.id === "string" && typeof record.difficulty === "string" && Number.isFinite(record.at) &&
      typeof record.result === "string" && Array.isArray(record.lines) &&
      record.lines.every((line: unknown) => typeof line === "string")).slice(0, 12);
  } catch {
    return [];
  }
}

export function saveMatch(record: MatchRecord) {
  try {
    const existing = loadHistory().filter(match => match.id !== record.id);
    localStorage.setItem(historyKey, JSON.stringify([{ ...record, lines: record.lines.slice(-120) }, ...existing].slice(0, 12)));
  } catch {
    // Private browsing and storage limits do not interrupt a match.
  }
}

export function sandboxRetreatPlan(turn: number, nextRetreat: number | undefined, hasCards: boolean, roll: number) {
  const due = nextRetreat ?? 8;
  const retreat = hasCards && turn >= due;
  return { retreat, nextRetreat: retreat ? turn + 2 * (3 + Math.floor(roll * 3)) : due };
}
