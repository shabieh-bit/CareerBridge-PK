# CareerBridge CV-to-Jobs MVP

## What it does
- User explicitly chooses **Analyze my CV** on /career.html. Text from a stored PDF or DOCX is parsed on the server.
- Heuristic extraction identifies known skills and degree mentions. It DOES NOT reliably infer experience, certify a degree, parse scanned/image CVs or employ AI-based reasoning. Students review and may choose to add detected skills to their own profile. Full CV text is never sent to an external job provider.
- Users select My City (manual Pakistani city), Anywhere in Pakistan, or Worldwide Remote. No precise GPS is collected.
- Pakistan local/nationwide vacancy results come from **Jooble Pakistan** and require `JOOBLE_PK_API_KEY`. Get a Pakistan-domain key at https://pk.jooble.org/api/about and add it to Render's private Environment panel, not GitHub. According to Jooble, free keys have a lifetime API request limit of 500; responses are cached for 15 minutes.
- Worldwide remote options use the public **Jobicy** API with `geo=anywhere`. Not all remote employers accept workers in Pakistan; candidates must confirm eligibility on the original listing.
- The job skills identified in provider excerpts produce an **indicative skill overlap**, NOT an official eligibility or employment probability. Missing skills trigger learning links (e.g. Microsoft Learn), a link to Microsoft's credential directory, and a YouTube search (not a vetted or certified video).
- `action_plans` records belong to the signed-in user. Learning checkboxes only track study; they do not silently update profile skills. After adding verified skills to Student Profile, press **Recheck match**, which creates an updated comparison.
- Existing manual job eligibility flow also offers missing-skill learning resources.

## Configure
1. Run `schema.sql` (CREATE TABLE IF NOT EXISTS) on the Neon `careerbridge` database. New tables: `cv_analysis` and `action_plans`.
2. Set the Render environment secret `JOOBLE_PK_API_KEY` for current Pakistan listings.
3. Deploy this branch to a staging service, test with non-sensitive dummy CV and sample search terms, then merge into `main` for production.
4. Run `npm install && npm test` (CI includes a disposable PostgreSQL service).
5. On /career.html: analyze CV, review detected skills, add to profile as needed, select location and role, search, create plan, use official learning links, update profile, recheck.
6. If a job source is not connected, the app shows an explicit no-feed warning instead of invented vacancies.

## Privacy and security
- CV file content is held in the existing restricted `cv_files` table; parsed skill/education summary alone is persisted in `cv_analysis`.
- CV uploads are never publicly shared. Job providers receive only user-selected role and city search, not CV bytes or identifying information.
- Scanned PDF extraction, malware scanning, sophisticated document isolation and CV data retention policies are not implemented, and are recommended before public launch.
- Do not treat a job matching score or any skill-detector output as proof of educational qualifications, competency, or hiring eligibility.
