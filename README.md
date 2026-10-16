# CareerBridge PK

CareerBridge PK helps students compare their skills with a job or internship, understand skill gaps, save opportunities and track their own application preparations.

## Tech stack
- Frontend: original HTML, CSS, JavaScript
- Backend: Node.js, Express, server API routes
- Database: PostgreSQL
- Authentication: bcrypt-hashed passwords and httpOnly, database-backed sessions

## Run locally
1. Install Node.js 20+ and PostgreSQL.
2. Create an empty PostgreSQL database.
3. Run `psql "$DATABASE_URL" -f schema.sql` (or paste `schema.sql` into your database provider's SQL editor).
4. Copy `.env.example` to `.env` and set `DATABASE_URL`. Node does **not** load this file automatically: use `node --env-file=.env server.js` or export variables into your shell.
5. Run `npm install`, then `npm start` (if variables were exported) or `node --env-file=.env server.js`.
6. Visit http://localhost:3000. Run unit tests with `npm test`.

## Deploy to Render
1. Create a hosted PostgreSQL database with persistent storage (Render Postgres, Neon, Supabase, or equivalent). Copy its connection URL. Verify whether your provider requires SSL; set `DATABASE_SSL=true` if needed and ensure certificates are verified.
2. Execute `schema.sql` against **that hosted database**, using its SQL editor or psql.
3. Create a Render Web Service connected to this GitHub repository, branch `main` **after the feature PR has been merged** (or branch `feature/midterm-backend` for an isolated test).
4. Runtime Node, build command `npm install`, start command `npm start`. Set `DATABASE_URL` as a secret environment variable, `NODE_ENV=production`, and `DATABASE_SSL` if required.
5. Deploy. Test the live URL, `/api/health`, signup, profile save, matching, saved jobs, logout and login. Do not claim hosting is complete until this works.
6. Replace the placeholder URL below with your verified Render URL.

**Live website:** https://careerbridge-pk.onrender.com — available via Render. Verify latest deployment before the midterm.

## Demo workflow
1. Register as a student on /auth.html.
2. Save degree, city, interest and skills in /student-profile.html.
3. Use /eligibility-check.html to paste a sample vacancy URL, role and required skills.
4. View server-calculated matched and missing skills on /match-result.html.
5. Save a job, track an application manually and revisit /dashboard.html.
6. Log out and sign back in to prove cloud persistence.

**Important:** This matching tool uses skills entered manually by the student, not an automatically parsed job post. The eligibility percentage is a skill-overlap score, not a formal determination of eligibility. “Apply and track” records your intent in CareerBridge; it does **not** submit to an employer. CVs can optionally be uploaded later as private PDF or DOCX documents (up to 3 MB); no CV analysis is performed.

## API
- POST /api/auth/register, /api/auth/login, /api/auth/logout; GET /api/auth/me
- GET/PUT /api/profile
- POST /api/matches; GET /api/matches/latest
- GET/POST /api/saved-jobs
- GET/POST /api/applications
- GET /api/health

## Security notes
Passwords are hashed; sessions are stored as token hashes in the database, with 7-day expiry and httpOnly SameSite cookies. Endpoints scope data to the authenticated user. Never commit `.env` or database credentials. Use HTTPS in production. This is an educational MVP; before public scale, add account recovery, email verification, security monitoring, production-grade migrations, and CSRF protection for cookie-authenticated mutations.

## Team roles and commits
**Before submission:** Replace this section with the actual members' names, responsibilities and GitHub commit links. Each team member must contribute commits themselves, and each member should speak in the defense. Do not invent contributions.

## Administrator dashboard

The private admin dashboard is available at `/admin.html`. Registered accounts are **not** administrators automatically. The API checks `users.is_admin` on each authenticated request and rejects non-admin users with HTTP 403. The dashboard shows totals and the latest 50 records from each category; it deliberately excludes password hashes and session tokens.

To authorize a trusted owner account, first confirm their exact registered email, then run the following in the private Neon SQL editor (do **not** commit or paste credentials):

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'confirmed-owner@example.com';
```

Replace the example email only after checking the intended account. Sign out and back in if necessary. `admin.js` is a public asset; authorization happens in the protected server API, not only in JavaScript.

## Optional CV documents
Student Profile (`/student-profile.html#cv-section`) allows each signed-in student to upload a PDF or DOCX CV (max 3 MB), or skip it and add it later. The Student Dashboard includes an **Add / Manage CV** link. File bytes are stored in the private `cv_files` PostgreSQL table, linked to the student's user ID; they are not saved on Render's temporary filesystem.

- `GET /api/cv`: view only your own CV metadata (not the bytes)
- `PUT /api/cv`: upload or replace your CV using a binary request
- `GET /api/cv/download`: authenticated attachment download
- `DELETE /api/cv`: permanently remove your CV

The backend checks logged-in ownership, accepted file type and size. CV content is **not parsed for matching**. Future production expansion should consider managed object storage, antimalware scanning, backups, and a retention/privacy policy.

## CV-based job discovery (feature branch)
A second workflow is available at `/career.html` with student-controlled CV text extraction, confirmation before updating profile skills, and source-linked job discovery.

- **My City** and **Anywhere in Pakistan** use Jooble Pakistan's API only when a private `JOOBLE_PK_API_KEY` is configured.
- **Worldwide Remote** uses the key-free Jobicy API, restricted to worldwide-tagged listings.
- Provider excerpts are not full job specifications, so any detected skill score is an **indicative overlap only**.
- Students create saved action plans with official learning resources, tutorial search links, study checkboxes and a *Recheck match* step after profile updates.
- See [CV matching guide](docs/CV_JOB_MATCHING.md) for complete setup, privacy caveats and release requirements.

The live URL remains on the stable main deployment until this feature is tested and approved.
