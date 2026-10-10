# GrowMate

FastAPI + LangGraph backend and Next.js frontend for a KOC content-growth demo.

## Local Windows setup

Create a backend `.env` using `.env.example` and provide your own DeepSeek API key.
The default model is DeepSeek-V4.1-Flash, whose official API identifier is `deepseek-flash`.
Keys are never supplied by source code. Replace any previously exposed key in the provider console.

Backend terminal:

```powershell
cd D:\ai-agent
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api_app:app --host 127.0.0.1 --port 8000
```

Frontend terminal:

```powershell
cd D:\ai-agent\frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend proxies `/api` to `http://127.0.0.1:8000`.
Optional `BACKEND_URL` configures a different backend when building the frontend.
Workflow and account requests always use the same-origin `/api` proxy so cookies work
consistently on both localhost and 127.0.0.1. `NEXT_PUBLIC_API_BASE_URL` is no longer used.

## Validation

```powershell
cd D:\ai-agent
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd frontend
npm run lint
npm run build
```

Regression tests mock the model and do not make paid inference calls. They cover goals,
question semantics, invalid inputs, duration budgets, JSON repair, manual/mock metrics,
review strategy memory, concurrent session updates and an API round trip.

## Behavior and limits

- Growth goals travel with the profile through generation and review.
- Scripts target 3.5 spoken characters per second, validate a 3-4 character/second range,
  and show estimated speaking duration. Timing is an estimate, not a guaranteed recording duration.
- Long scripts generate chapter by chapter; they take longer than short scripts.
- Real data entry is blank by default. Simulated metrics are explicitly labeled.
- Reviews calculate evidence from supplied metrics and disclose missing retention/timing/history data.
- Strategy memory persists independently of the currently displayed review and retains ten rounds.
- Anonymous sessions persist in `.growmate-sessions.sqlite3`; stale rows are cleaned up on writes
  after seven days. Browser progress persists locally with a seven-day limit.
- Source includes generic provider API configuration, not a guarantee of model availability.

## Server update

Upload the changed backend files and `frontend` source to their corresponding server directories.
Do not overwrite the server `.env` with local credentials. Install backend requirements,
then build the frontend successfully before restarting its process.

```bash
cd /home/ubuntu/ai-agent
.venv/bin/python -m pip install -r requirements.txt
npm run build && pm2 restart growmate-frontend
pm2 restart growmate-backend
pm2 save
```

These commands assume the existing server layout places the frontend package at the project root.
If the server uses a `frontend` subdirectory, run the build in that directory instead.
For long scripts, configure the reverse proxy read timeout to at least 900 seconds;
otherwise the proxy may cut off an otherwise running generation request.

## Accounts and private projects

The local demo now has real email/password registration and login, editable account names,
logout, and private server-side project snapshots (save, list, open, delete with confirmation).
Guests can still use the complete workflow. Browser progress is scoped per account, with a
separate guest cache; signing in does not import or erase a guest's existing work.

Passwords use salted scrypt hashes. Login cookies are HttpOnly, SameSite=Lax and expire after
seven days; only hashed session tokens are stored. Auth attempts are rate limited, mutation
origins are checked, saved projects are owner-filtered, and authenticated workflow sessions
cannot be opened by another account or a guest. Auth responses are not cached.

Accounts and project snapshots persist in `.growmate-accounts.sqlite3` (override with
`GROWMATE_ACCOUNT_DB`). Include this database and the workflow database in private backups;
do not upload them to Git or expose them as static files. Deleting a project is permanent.

For public deployment, enable HTTPS before accepting real passwords. Set
`GROWMATE_SECURE_COOKIE=1`, `GROWMATE_ALLOWED_ORIGINS=https://your-domain.example`, and pass
`X-Forwarded-Proto` from the HTTPS reverse proxy. HTTP is only appropriate for local testing.
Email ownership verification, password reset, third-party OAuth, and cross-device automatic
draft syncing are not implemented. Saved snapshots can be restored across browsers after login.

## UI References

The redesigned workbench uses persistent workflow navigation, list-based topic comparison,
a document-style script view, compact page headings, and real rather than fabricated task data.
References reviewed: [Buffer Create](https://buffer.com/create),
[Later's social calendar](https://later.com/social-media-content-calendar/), and
[Jasper Canvas](https://www.jasper.ai/canvas). These are design references, not integrations;
GrowMate still does not automatically publish to social platforms.
