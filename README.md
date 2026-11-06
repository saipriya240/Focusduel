# FocusDuel

**LOCK IN. SHOW UP. WIN.**
*Your biggest competition is your distracted self.*

FocusDuel turns productivity into a competitive sport: tracked focus sessions, live 1v1 duels on a shared clock, XP and levels, leaderboards, a squad feed, and an AI roast hall for the days you fumbled the bag.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite, Tailwind CSS, Framer Motion, lucide-react, React Router |
| Backend | Base44 (managed Postgres-backed entities, serverless functions, realtime subscriptions) |
| Auth | Base44 Auth — email/password, Google, password reset, optional MFA |
| AI | Base44 `InvokeLLM` called **only** from a backend function |

There is no separate Supabase project: Base44 provides the equivalent primitives (tables with row-level security, server functions, realtime, auth). All secrets live server-side — the AI prompt never runs in the browser.

---

## Architecture

```
src/
  pages/            Route screens (Home, FocusRoom, Battles, BattleRoom, Leaderboard,
                    HallOfShame, Analytics, Friends, Settings, Onboarding, auth pages)
  components/       Layout shell, notification bell, focus timer + ambience, battle modal,
                    feed cards, dashboard tiles
  context/          ProfileProvider — one source of truth for the signed-in player
  lib/              formatting helpers, achievement catalogue, Web-Audio ambience engine
base44/
  entities/         Table schemas + row-level security rules
  functions/        finishSession, battleAction, friendAction, getLeaderboard,
                    generateRoast, shameAction
  shared/           gamification.ts — XP curve, level maths, streak and date helpers
```

### Trust boundaries (important)

* **XP, levels, streaks and battle results are computed server-side.** The browser never writes `xp`, `level`, or a winner. `finishSession` caps focus time at the planned duration and re-derives every counter from stored records.
* **Battle timing is server time.** Acceptance stamps `starts_at` / `ends_at`; the room renders a countdown from those timestamps, so changing the local clock cannot buy focus minutes.
* **Focus credit is earned by heartbeat.** While a player signals focus, the server credits `min(elapsed, 30s)` per ping. Pausing stops credit; closing the tab stops credit. Disconnecting never awards a win.
* **Records written by functions are scoped by the stored player id** (`user_id` / `actor_id` / `audience_ids`), not by the creator stamp, so players can always read and delete their own data.
* **Roasts are prompt-bounded**: tone is chosen from three presets and the model is instructed to refuse hate speech, threats, sexual content, harassment and protected-class references. Roasts are opt-out per player.

### Data model

`UserProfile`, `FocusSession`, `Battle`, `Friendship`, `FriendRequest`, `ActivityFeed`,
`ShamePost`, `ShameComment`, `ShameLike`, `Notification`, `UserAchievement`.

Row-level security summary:

| Entity | Read | Write |
| --- | --- | --- |
| UserProfile | any signed-in player (public handles for search/leaderboards) | owner only |
| FocusSession, UserAchievement | owner (+ admin) | owner / server only |
| Battle, Friendship, FriendRequest | the two participants (+ admin) | server only (`battleAction`, `friendAction`) |
| ActivityFeed, ShamePost, ShameComment | the actor's friend network (`audience_ids`) | owner; likes/comments/reports via `shameAction` |
| Notification | recipient only | server only |

---

## XP and rewards

| Event | XP |
| --- | --- |
| Completed focus session | 1 XP per focused minute |
| Partial session | 0.5 XP per focused minute |
| Daily goal reached | +50 (once per local day) |
| Battle won | the battle's stake (default 40) |
| 7-day streak | +100 |

Badges: First Blood, Locked In, No Distractions, Unstoppable, Focus Legend, Deep Diver. Each code unlocks once per player — `finishSession` and `battleAction` check existing records before inserting.

Levels follow an increasing curve (200 XP for level 2, +100 more per level) and are recomputed from total XP on every award.

---

## Running it

1. Open the app in the Base44 editor — the preview is the running app.
2. Sign in (email/password or Google) and complete the three-step onboarding: identity, targets, preferences.
3. Publish from the editor when you want a live URL.

**Environment variables:** none are required. The Base44 runtime injects the app id (`BASE44_APP_ID`) and the AI integration; there is no API key in the frontend bundle. If you later connect a model provider directly, add its key with `set_secrets` and read it inside a function via `secrets.get("NAME")` — never in `src/`.

**Realtime:** battles, notifications and battle rooms subscribe to entity changes, so a second signed-in browser sees updates without refreshing.

---

## Feature notes and honest limits

* **Ambience is generated in the browser** with the Web Audio API (rain, café hum, white noise, forest, a procedural lo-fi pad). No sampled or copyrighted audio is bundled — drop licensed tracks into `src/lib/ambience.js` if you want real lo-fi playlists.
* **Duels need two accounts.** Invites, acceptance, heartbeats and settlement are all implemented, but a single-player verification can only prove the guards (e.g. you cannot duel yourself or a non-friend).
* **Leaderboards** are computed by a server function over stored sessions and battle records — nothing is hardcoded. They refresh on demand and on page load rather than streaming continuously.
* **Hall of Shame** posts default to your friend network. Deleting your own post, liking, commenting, sharing and reporting are implemented; reported posts are counted for moderation rather than auto-hidden.
* **Analytics** is derived from stored `FocusSession` rows only; duel focus time is written back as sessions when a battle settles.

---

## Design system

Charcoal `#08090A` → near-black surfaces, acid green `#B6FF3B`, white/muted-grey type, red for losses and warnings. Oversized Anton display headings, Inter body, JetBrains Mono for numerals and labels. Glass panels, animated progress rings, staggered bar charts and spring-based result modals. Desktop uses a fixed sidebar; mobile uses a five-slot bottom bar with the timer kept thumb-reachable.