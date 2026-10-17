# FOCENTRA

<p align="center">
  <img
    src="assets/focentra-banner.png"
    alt="FOCENTRA — Find your focus. Make it count."
    width="100%"
  />
</p>
<h3 align="center">Find your focus. Make it count.</h3>

<p align="center">
  A study space for getting things done.
  <br />
  Focus sessions, study goals, leaderboards, and groups — all in one place.
</p>

<p align="center">
  <a href="YOUR_LIVE_WEBSITE_URL">Live Website</a>
  &nbsp; · &nbsp;
  <a href="YOUR_GITHUB_REPOSITORY_URL">Repository</a>
</p>

---

## The idea

FOCENTRA started with a simple idea: studying is easier when you have a place to stay focused and a way to see your progress.

It's built around the things that make a study routine work — sitting down for a session, setting a goal, keeping track of your time, and finding people who are working towards something similar.

No complicated productivity system. Just a space to study, track your effort, and keep going.

## What's inside

**Focus sessions**

Set aside time for studying and keep your attention on the task in front of you. Your focus sessions help make your study time more intentional.

**Study goals**

Give your work a direction. Create goals, keep track of what you're working towards, and stay accountable to your targets.

**Leaderboards**

See how your study progress compares with others. A little friendly competition can be a good reason to show up consistently.

**Study groups**

Find your people. FOCENTRA includes study groups for JEE, NEET, CBSE, ICSE, college, and other study paths, giving students a place to connect around what they're learning.

**Your profile**

Keep your study identity and activity together, with a personal space inside the platform.

**A dark, focused interface**

A dark theme, clean layout, and subtle visual details keep the experience centred on studying rather than distractions.

## Built with

- **React** + **TypeScript** — the interface
- **Vite** — development and production builds
- **Supabase** — authentication, database, and backend services
- **CSS** — styling and visual effects
- **Lucide React** — icons

## Running it locally

You'll need Node.js, npm, and a configured Supabase project.

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd FOCENTRA
npm install
```

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Add your own Supabase project values, then start the development server:

```bash
npm run dev
```

To create a production build:

```bash
npm run build
```

## A small note on security

Environment variables belong in your local `.env.local` file and in your deployment provider's environment settings — not in your repository. Never expose a Supabase `service_role` key in frontend code.

## FOCENTRA

*Less drifting. More doing.*

