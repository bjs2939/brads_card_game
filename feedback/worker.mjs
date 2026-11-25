import { createFeedbackIssue, feedbackCategories } from "../src/playtest.ts";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = (env.FEEDBACK_ORIGINS ?? "").split(",").map(value => value.trim());
    if (!origin || !allowed.includes(origin) || new URL(request.url).pathname !== "/api/feedback") {
      return new Response(null, { status: 403 });
    }
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Vary": "Origin",
    };
    const reply = (status, data) => Response.json(data, { status, headers });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply(405, {});
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reply(415, {});

    const reader = request.body?.getReader();
    if (!reader) return reply(400, {});
    const decoder = new TextDecoder();
    let raw = "";
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12000) {
        await reader.cancel();
        return reply(413, {});
      }
      raw += decoder.decode(value, { stream: true });
    }
    let data;
    try { data = JSON.parse(raw + decoder.decode()); } catch { return reply(400, {}); }
    const field = (key, max) => typeof data?.[key] === "string" && data[key].length <= max ? data[key].trim() : "";
    const id = field("id", 36);
    const name = field("name", 100);
    const email = field("email", 254);
    const category = field("category", 40);
    const subject = field("subject", 100);
    const description = field("description", 1500);
    const context = field("context", 300);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
        !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !subject || !description || !feedbackCategories.includes(category)) return reply(400, {});
    if (!env.FEEDBACK_DB || !env.GITHUB_TOKEN || !env.RATE_LIMIT_SALT) return reply(503, {});

    const source = request.headers.get("CF-Connecting-IP");
    if (!source) return reply(403, {});
    const bucket = Math.floor(Date.now() / 3600000);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.RATE_LIMIT_SALT + ":" + source + ":" + bucket));
    const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const db = env.FEEDBACK_DB;
    try {
      const prior = await db.prepare("SELECT issue FROM feedback WHERE id = ?").bind(id).first();
      if (prior) return prior.issue ? reply(200, { issue: prior.issue }) : reply(409, {});
      await db.prepare("DELETE FROM feedback_limits WHERE bucket < ?").bind(bucket - 1).run();
      const rate = await db.prepare("INSERT INTO feedback_limits VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < 5 RETURNING count").bind(key, bucket).first();
      if (!rate) return reply(429, {});
      const inserted = await db.prepare("INSERT OR IGNORE INTO feedback (id, name, email, submitted_at) VALUES (?, ?, ?, ?)").bind(id, name, email, new Date().toISOString()).run();
      if (!inserted.meta.changes) return reply(409, {});

      const report = createFeedbackIssue(category, subject, description, context, name);
      const github = await fetch("https://api.github.com/repos/bjs2939/brads_card_game/issues", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, "User-Agent": "brads-card-game-feedback",
          Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ title: report.title, body: report.body + "\n\n<!-- feedback: " + id + " -->",
          labels: ["feedback"] }),
      });
      if (!github.ok) {
        if (github.status < 500) await db.prepare("DELETE FROM feedback WHERE id = ? AND issue IS NULL").bind(id).run();
        return reply(502, {});
      }
      const { number } = await github.json();
      if (!Number.isSafeInteger(number)) return reply(502, {});
      await db.prepare("UPDATE feedback SET issue = ? WHERE id = ?").bind(number, id).run();
      return reply(201, { issue: number });
    } catch {
      return reply(503, {});
    }
  },
};
