# CareerBridge Midterm — Final Checklist

## Repo and runtime
- [ ] CI tests pass, including `npm test` and Node syntax checks
- [ ] Hosted PostgreSQL provisioned; schema.sql applied
- [ ] Secrets exist only in hosting environment (never commit DATABASE_URL)
- [ ] Web service deployed through Render or equivalent
- [ ] /api/health returns {"status":"ok"}
- [ ] Create account, login and logout work
- [ ] Profile stays after sign-out / sign-in
- [ ] Matching is calculated and saved in database
- [ ] Saved job appears on dashboard after refresh and sign-in
- [ ] Application tracking visible, and does not claim an external application was sent
- [ ] Verify on phone and desktop; use two browser sessions to confirm user isolation
- [ ] README contains actual verified public deployment URL
- [ ] Feature PR reviewed and merged to main after verification

## Academic defense
- [ ] Investor pitch under 5 minutes
- [ ] Live site (not laptop-only, not screenshots)
- [ ] Every team member speaks
- [ ] All team members' actual roles stated; each has real GitHub commits
- [ ] Rehearse 2-minute Q&A
- [ ] Check Render free-tier sleep: wake site before presentation

## Product honesty
- [ ] Matching is labelled a skill-overlap estimate, not formal job eligibility
- [ ] Vacancy requirements are manually entered
- [ ] CV upload is not supported
- [ ] Apply-and-track saves an internal tracker; does not send an employer application
