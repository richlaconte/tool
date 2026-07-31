# 01 — Product Spec: Tactics FC Prototype

## Vision

**Tactics FC is Teamfight Tactics for football.** You scout and buy fictional footballers in a transfer market, arrange them on a pitch where position and chemistry matter, then watch your squad play an automated match where every event — a through ball, a blocked shot, a penalty — emerges from the players' stats, their positions, and the combinations you discovered. Seven AI managers are doing the same thing. Last manager standing wins.

The prototype exists to prove one thing: **that watching a match your decisions created is fun enough to make people immediately play again.**

## Target demo audience

- Steam-literate auto-battler and football-management fans (Next Fest-era demo)
- Playtesters and, later, investors/acquirers evaluating the core loop
- Runs in a browser from a public URL; no install, no account

## Design pillars

1. **My squad, my story.** Every match event should be traceable to a decision the player made (a signing, a pairing, a position). Commentary names your players.
2. **Readable depth.** Combinations (nationality, position-line, archetype) are visible and countable — a player should think "one more Brazilian and my attack unlocks."
3. **Snackable spectacle.** A match is ~90 seconds at full drama, 15 seconds in Turbo. The timeline is the show.
4. **Always another run.** 10–15 minute sessions, instant rematch.

## Core loop (one round)

```
TRANSFER WINDOW (buy/sell/reroll from a shop of 5) 
  → TACTICS BOARD (place players on the pitch grid)
  → MATCH (automated, vs a paired opponent, watch or turbo)
  → RESULTS (score, damage to HP, standings, prize money)
  → next round (richer shop, tougher opponents)
```

A session: 8 managers (you + 7 AI), each 20 HP. Rounds continue until one manager remains. Placement 1st–8th shown at the end.

## User stories (MoSCoW)

### MUST (prototype is meaningless without these)

- **US-1** As a player, I can start a new run from the landing screen in ≤2 clicks and reach my first match within 60 seconds.
- **US-2** As a player, each Transfer Window I see a shop of 5 player cards showing name, position, nationality flag, archetype, stats, and cost; I can buy (to bench), sell, and pay 1 credit to reroll the shop.
- **US-3** As a player, I can drag (or tap-place) players from my bench onto a pitch diagram, subject to my squad-size cap, and swap/remove them freely before confirming.
- **US-4** As a player, I can see my active combinations (e.g. "Samba Flair 2/3", "Defensive Wall 2/2") with their current and next-tier bonuses.
- **US-5** As a player, the match plays out as a timeline of narrated events (shots, saves, goals, fouls, set pieces) on a pitch view, with a play/pause/speed control and a Turbo skip.
- **US-6** As a player, match outcomes are visibly caused by stats + position + combos (e.g., commentary or tooltips reference them: "Silva's pace beats the fullback").
- **US-7** As a player, after the match I see the score, HP damage dealt/taken, prize credits, and the live standings of all 8 managers.
- **US-8** As a player, my 7 AI opponents build sensible squads that get stronger over rounds, so I feel escalating pressure.
- **US-9** As a player, when I'm eliminated or win, I get a results screen with placement and a one-click rematch.
- **US-10** Session state survives a page refresh (mid-run resume) via browser storage; nothing leaves the browser.

### SHOULD (include if tasks finish early, in this order)

- **US-11** Friend challenge: a "Copy challenge link" button encodes my squad + seed into a URL; a friend opening it plays an async match against my squad's snapshot and sees who wins. No server.
- **US-12** Post-match event log with per-event probability tooltips ("this shot had 34% to score").
- **US-13** Sound effects for goals and a simple background music loop.
- **US-14** Basic onboarding coach-marks on the first three screens (dismissible, shown once per session).

### COULD (post-MVP parking lot — do not build)

- Live synchronous multiplayer, matchmaking, lobbies
- More combo families (club-style, league), player traits/injuries/morale
- Economy depth: interest, win/loss streaks (star merging shipped 2026-07-31)
- Meta progression, profiles, leaderboards, daily challenges
- Monetization of any kind

### WON'T (hard exclusions — constitution-level)

- Auth, accounts, servers, databases, analytics tracking
- Real player/club names or likenesses, including disguised soundalikes
- Native mobile apps
- Any feature requiring network beyond static hosting

## Screens (4)

*(Style refactor, implemented — see `06-style-refactor.md`: Transfer Window and Tactics Board are merged into one persistent TFT-style Planning screen.)*

1. **Landing** — title, "New Run", "How to Play" (3-panel explainer), "Continue" if a saved run exists.
2. **Planning** — one persistent screen with persistent top HUD (round/HP/credits/streak/next opponent), combo panel, striped pitch board with line zones (GK/DEF/MID/FWD), bench with sell mode, shop bottom bar (5 cards, reroll), and one sticky amber "Kick Off vs {opponent}" CTA. All planning actions (buy/sell/reroll/place/unplace) available in both TRANSFER_WINDOW and TACTICS phases.
3. **Match View** — animated pitch with physics-ball movement, event timeline feed (color-coded friendly/enemy, defined minute-badge style), scoreboard, speed controls, Turbo button.
4. **Results & Standings** — match summary, damage, prize, 8-manager standings table, next-round button; end-of-run variant with placement + rematch.

## Acceptance criteria (prototype level)

- **AC-1** A complete run (7+ rounds to elimination or victory) is playable start-to-finish in a desktop Chrome browser with zero console errors.
- **AC-2** Time from landing page to first match start ≤ 60 seconds for a first-time user.
- **AC-3** Every match is reproducible: same seed + same two squads → identical event log (verified by automated test).
- **AC-4** At least 4 combination families exist, each with 2 tiers, each mechanically affecting match probabilities.
- **AC-5** Positioning matters measurably: an automated test shows a striker played at GK performs statistically worse than at FWD over 1,000 simulated matches.
- **AC-6** AI opponents' average squad strength increases round-over-round (verified by test over 100 simulated runs).
- **AC-7** The game is fully playable at 390px viewport width (tap instead of drag).
- **AC-8** Deployed to a public HTTPS URL as a static site; loads ≤ 3s on 4G.
- **AC-9** Refreshing mid-run restores the run to the start of the current round.
- **AC-10** Playtest: 3 external playtesters complete a run each with no founder assistance; feedback notes filed.

## Success signal (the kill/continue gate)

Per the strategy docs, this prototype feeds one decision: do playtesters self-return? Target: **at least half of playtesters start a second run unprompted, and at least one asks "when can I play more?"** If three iterations of the watch phase don't produce that signal, we stop or re-scope (see `../strategy-decision-memo.md` kill criteria).
