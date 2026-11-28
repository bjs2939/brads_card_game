# brads_card_game
Full Stack Web-based version of a custom card game created by two brothers. Built with React, TypeScript, Node.js, and SQL for online gameplay and data tracking.

## v0.2 playtest

- Feedback requires a name and return email. Players preview the public report and submit from the game. The backend associates contact details with the issue number in a private database. Optional diagnostics contain game version and coarse match counts.
- Sandbox is a **VS Computer** difficulty with a defensive opponent that never attacks. **Training Grounds** is a separate main-menu mode. Its Lab opens during your turn and lets you add or remove cards in either hand or battlefield. Move a card already in play by removing it before adding it elsewhere.
- Match History keeps up to 12 recent matches in this browser. Turn Timer starts off and is available in match settings. Campaign opens an interactive map with nine Coming Soon locations. Edit the `x` and `y` percentages in `src/campaign.ts` to move its location markers.
- Run `npm run dev` for local play, or `npm run build` for a production build.

## Enable direct feedback

GitHub Pages serves the game. The feedback API is a separate Cloudflare Worker with a private D1 database. No AWS services are used.

1. Create a private D1 database and apply `feedback/schema.sql`. Deploy `feedback/worker.mjs` with Wrangler and bind the database as `FEEDBACK_DB`. Set the non-secret Worker variable `FEEDBACK_ORIGINS` to `https://bjs2939.github.io,http://127.0.0.1:5173`.
2. Create a fine-grained GitHub token scoped to this repository with **Issues: Read and write**. Set it as the Worker secret `GITHUB_TOKEN` and set `RATE_LIMIT_SALT` to a random secret. Create the `feedback` repository label. Categories appear in issue titles.
3. Set the GitHub Actions repository variable `VITE_FEEDBACK_ENDPOINT` to the Worker URL ending in `/api/feedback` and rerun Pages deployment. For local testing use the same variable in `.env.local` and restart Vite.
4. Find private contact details with `SELECT name, email FROM feedback WHERE issue = ?` in the restricted D1 console. Only maintainers who handle feedback should have database access. Pending rows have a null issue. If a request timed out after GitHub accepted it, find the issue by its embedded feedback ID and reconcile the row before retrying. Delete contact details once follow-up is complete.

The API allows five requests per hour per source, retains only salted rate-limit keys, and uses a submission ID to prevent retries from creating duplicate issues. Screenshots are deferred.
