# CareerBridge PK — Phase 1 Live Demo Checklist

**Public application:** https://careerbridge-pk.onrender.com

This guide demonstrates implemented features only. The sample opportunity board is **not** a verified vacancy feed. Skill matching is based on manually entered requirements.

## Before the presentation
- Confirm the latest Render deployment is **Live**.
- Open `/api/health`; it should show `{"status":"ok"}`.
- Log in to a **demo student account** that contains no personal or sensitive information.
- Prepare one fictitious sample job: title “Data Analyst Internship (Demo)”; location “Lahore”; requirements “Excel, Python, SQL”.
- Save a profile with degree, semester, city, career interest, and skills “Excel, Python”. A score around 67% is expected for this example.
- Open the public site at least 2 minutes ahead of presenting in case the free hosting service has gone idle.
- Verify the demo on a laptop and a mobile browser. Do not show secrets or production database credentials.

## Live click path (around 90–120 seconds)
1. Homepage: describe who the platform is for; select **Check my career readiness**.
2. Register or log in using the demo account; show **student profile**.
3. Show degree, city, interests and skills; save the profile.
4. Enter sample job URL, role, location and skills. Explain requirements are entered manually.
5. View **skill match** percentage and missing skills. Explain it is *not* official eligibility.
6. Click **Save job** then **See my action plan**; press **Apply and track** (records internal progress; does not submit to an employer).
7. Open **My Dashboard** and show persisted saved jobs and tracked actions.
8. If authorized, open **Admin Dashboard** briefly and show totals without revealing student private details.

## 5-minute investor pitch
- 0:00–0:40 — Problem: students lack clear visibility into skill gaps.
- 0:40–1:20 — Solution: account, profile, comparison and tracking.
- 1:20–3:20 — Live demo as above. Every team member speaks.
- 3:20–4:10 — Why this matters to students and institutions.
- 4:10–5:00 — Roadmap (verified vacancy listings, better recommendations, CV tools), and invitation for pilot users and feedback.
- 5:00–7:00 — Q&A: no screenshots as a replacement for the live product.

## Likely questions and accurate answers
- **Is it AI-based?** Not yet. The current MVP uses a transparent rule-based skill comparison.
- **Are these genuine job opportunities?** The current opportunities page shows preparation examples, not live vacancies. Job URLs and requirements are entered by users.
- **Where is the data stored?** In the Neon PostgreSQL backend, accessed via a Node.js API deployed on Render.
- **Does Apply and track send an application?** No, it records an action within CareerBridge.
- **Can one student view another's profile?** The API scopes student data to their authenticated account; administrators have a separate restricted reporting API.

## Submission checklist
- [ ] Latest CI checks pass
- [ ] Live deployment matches the tested commit
- [ ] Test profile/save/matching/tracker all work on the live URL
- [ ] Update README with real roles and individual commits from **every** team member
- [ ] Practice aloud; stay within 5-minute pitch + 2-minute Q&A
