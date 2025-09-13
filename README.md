# ChatVerse — MVP

Threads-first real-time chat with ephemeral “Pop-Up Rooms” and optional AI recaps (BYO key).

This repo ships a minimal working prototype that **does not require any AI API keys** to run and demo core flows. 
If you add an OpenAI API key in the UI, `/summary` upgrades to LLM summarization; otherwise it falls back to a lightweight local summarizer.

## Stack
- **Next.js (App Router)**, **React**, **Tailwind**
- **Supabase** (Auth, Postgres, RLS, Realtime, Storage; optional Edge Functions)
- **Vercel** for hosting (frontend) — or run locally via `npm run dev`
- **Postgres full-text search** for message search

## Quickstart

1. **Create a free Supabase project.** Note the *Project URL* and *anon key*.
2. **Create Storage bucket** named `attachments` (Public).
3. **Run the SQL in** `supabase/migrations/000_init.sql` then `000_policies.sql` in the Supabase SQL editor.
4. **Set env vars** (in Vercel or locally in `apps/web/.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
5. **Install & run**
   ```bash
   npm i
   npm run dev
   ```
6. Open `http://localhost:3000` → sign in with email magic link → create a Verse, channel, and start messaging.

### Optional (Room janitor cron)
If you deploy on Vercel, you can schedule GET `/_internal/cron/rooms` to auto-archive expired rooms. Locally you can hit it manually from the browser to simulate the cron.

### Optional (AI recap)
In the UI, open the command palette (⌘K) → “Set AI Key” → paste an OpenAI API key. 
- If omitted, `/summary` uses a local extractive summarizer (no external calls).
- If provided, the server route uses your key **without storing it** (the key is sent in the request body from your browser only when you trigger a summary).

## Acceptance Criteria mapping
- **<1s perceived send**: local echo + realtime confirm implemented.
- **Threads-first**: every message may have `parent_message_id`; thread panel in right rail.
- **Pop-Up Rooms**: `/room` creates an ephemeral channel with TTL; room becomes read-only after expiration; janitor route archives and writes a recap.
- **Permissions**: RLS policies restrict read/write to members and roles.
- **Invite link**: `/invite` slash command generates a join link; new users can redeem and join in <60s.
- **Search**: basic full-text search across message bodies.
- **Attachments**: uploads to Supabase Storage (10MB cap at UI).

## Monorepo layout
```
apps/web       # Next.js app
packages/ui    # Shared UI components
packages/db    # Types and helpers
supabase       # SQL migrations, docs, function stubs
```

## Notes
- This MVP is deliberately compact and readable. It aims to “just work” once Supabase URL + anon key are set, without any third-party billing.
- Storage & cron policies are minimal for demo; adapt before production.
