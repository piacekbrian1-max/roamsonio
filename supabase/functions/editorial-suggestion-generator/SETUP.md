# RoamSonio Weekly Editorial Suggestion Generator — Setup

## What this adds
- Sunday discovery at 9:00 AM America/New_York through GitHub Actions.
- OpenAI-generated candidates balanced across cities, regions, activities, seasons, and domestic/international ideas.
- Duplicate checks against existing editorial destination names, IDs, and build destinations.
- Wikimedia Commons photo candidates with source links and available creator/license metadata.
- New destination records are always `draft`; every generated photo is always `approved=false`.
- Run outcomes are written to the existing Master Admin audit log.
- No trip, trip snapshot, family, user, or account records are modified.

## Important: the code is committed, but live automation is not active until deployment and secrets are configured.

### 1. Deploy the Edge Function
In the Supabase project connected to RoamSonio (project ref `vqtqchxoecrahtrnoocy`), deploy the code at:
`supabase/functions/editorial-suggestion-generator/index.ts`

Use the Supabase Edge Functions deployment flow for the project. The function name must be exactly `editorial-suggestion-generator`.

### 2. Configure Supabase Function secrets
Set these secrets for the Edge Function:
- `OPENAI_API_KEY`: an API key permitted to call the OpenAI API.
- `EDITORIAL_JOB_SECRET`: a long, random secret used to authenticate the scheduled job.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never put the service-role key in the browser or GitHub repository.

### 3. Configure the GitHub Actions secret
In the repository Settings → Secrets and variables → Actions, add:
- `EDITORIAL_JOB_SECRET`: the exact same random value configured in Supabase.

Do not commit this value to any file.

### 4. Run a controlled test
In GitHub → Actions → **Weekly RoamSonio Editorial Suggestions** → Run workflow.
Verify that:
- The workflow returns success and a JSON summary.
- Newly created destinations have status `draft`.
- All created photos have `approved=false`.
- The Suggestion Inbox shows the drafts and photo readiness.
- No entry is visible publicly until a Master Admin approves and publishes it.
- No saved trips or snapshots change.

### 5. Weekly operation
After the manual test succeeds, the workflow runs Sunday at 9:00 AM Eastern. GitHub cron is UTC-based, so the workflow checks the Eastern clock and skips the other UTC slot during daylight-saving changes to avoid duplicate runs.

## Editorial safety
- Generated writing and image matches are suggestions, not verified travel advice.
- Review image suitability, licensing/credit, destination match, and alt text before approval.
- The generator never publishes automatically.
- If generation fails, existing published content is not changed.
- Missing or incomplete photography leaves the entry as a private draft.
- The current homepage must be verified separately to ensure it consumes the approved published editorial records/weekly edition as intended.
