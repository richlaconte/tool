# Soccer Auto-Battler (Mobile) — Deep Research & Product Plan

**Working title:** *Tactics FC* (placeholder)
**Date:** 2026-07-31
**Verdict up front:** The idea is **good but not safe**. It sits on genuine white space (there is no mainstream soccer auto-battler), but it has three make-or-break problems — the watch phase, licensing economics, and match length — that must be solved in a prototype *before* any serious money is spent. Details and pushback below.

---

## 1. What you're actually proposing

Take the Teamfight Tactics (TFT) / auto-chess core loop:

1. **Shop phase** — buy units from a randomized, shared pool with gold
2. **Build phase** — position units on a board, combine 3 copies to star-up, chase trait/synergy thresholds
3. **Watch phase** — combat resolves automatically; you observe
4. Repeat; last player standing of 8 wins

…and re-skin it for soccer:

- Units = soccer players, positioned on a pitch in a formation instead of a hex board
- Synergies ("traits") = nationality, club, league, position group, playstyle
- Combat = a simulated match (or match segment) instead of an arena brawl
- Economy = club budget; carousel round = transfer market / scouting draft

Your instinct on synergy axes is correct — team membership, nationality, and position are exactly the right starting traits, and this document adds several more.

---

## 2. Market research

### 2.1 The auto-battler genre: real, but past its gold rush

- Genre estimates cluster around **$2.3–2.5B in 2024**, with forecasts of $5–7B+ by the early 2030s (CAGR ~8–14% depending on the research house). Treat these as directional, not precise — market-research firms disagree wildly, but all agree the genre is large and mobile-led. [Sources: Growth Market Reports, Aug 2025; Dataintelo, Sep 2025]
- **TFT is the category king**: ~33M monthly players, ~285M registered users, ~$620M revenue in 2025, with **mobile contributing ~62% of revenue**. [Source: rec0ded88.com TFT statistics, Jul 2026 — third-party estimate, treat as approximation]
- TFT's mobile launch (Mar 2020) did **3.6M installs in week one** — 3.6× Auto Chess: Origin and 34× Dota Underlords. [Source: GamesBeat / Sensor Tower]
- **The graveyard matters**: Chess Rush (Tencent), Dota Underlords (Valve), Heroes of the Storm's attempt, and dozens of indie auto-battlers all stalled or shut down despite big IPs and budgets. The genre's winner-take-most dynamics are brutal: the fun is the *meta*, and the meta lives where the players are.
- Notably, the genre axis "Fantasy / Sci-Fi / Historical" dominates. There is **no successful sports-themed auto-battler** — which is either your opening or a warning. This research found no evidence anyone has proven the fit.

**Implication:** You are not entering "the auto-battler market" to fight TFT. You are entering the **soccer mobile market** with an auto-battler mechanic. That reframing changes everything about who your competitors are and how you acquire users.

### 2.2 The soccer mobile market: proven, enormous, license-gated

- Mobile sports games generated roughly **$1.0–1.1B IAP in 2025**, slightly down YoY (-2.9%) — a mature but not growing segment. [Source: InvestGame Mobile Market Landscape 2026]
- **Top Eleven (Nordeus)**: 240M+ registered users; successful enough that Take-Two acquired Nordeus in 2021. Critically, Top Eleven succeeded for years **without real player names** — it monetizes club-building, facilities, and official merch partnerships. [Source: Take-Two acquisition press release, Jun 2021; GameDeveloper interview with Nordeus]
- **FIFA Rivals (Mythical Games, officially FIFA-licensed)**: launched Jun 2025, 1M downloads in 6 weeks, 2.5M by mid-2026 — decent but not explosive *even with the FIFA license and a World Cup tailwind*. This is a useful reality check on what licensing alone buys you. [Source: games.gg; blockchaingamer.biz, Jun 2026]
- EA Sports FC / eFootball dominate the "play the match" segment. Football Manager Mobile owns the deep-sim niche. **The mid-core "build a squad, watch it play, out-think other managers" space is under-served** — Top Eleven is the closest and it is 15 years old with an aging UX.

### 2.3 Acquisition economics (the unglamorous killer)

- Mid-core/strategy CPI in 2025–2026: **Android $2–4.50, iOS $3.50–6.50**, with Tier-1 iOS frequently $4–5.50+. [Sources: Admiral Media 2025 benchmarks; GameGrowthAdvisor 2026]
- Sports-adjacent games enjoy cheaper CPIs (~$1–2.50 Android) and — unique to soccer — **predictable organic acquisition spikes** around the World Cup, Euros, Champions League knockouts, and transfer windows.
- Mid-core payback windows run **90–180 days**, and healthy targets are LTV:CAC ≥ 3:1, D1 retention ~26–28% (top quartile), D7 ~7–8%, D30 3–10%. [Sources: Admiral Media; Playio/GameAnalytics benchmarks 2025]
- A realistic three-phase soft launch for a mid-core title costs **$420K–$1.3M in UA/testing spend alone** before global launch. [Source: GameGrowthAdvisor soft-launch playbook, 2026]

---

## 3. The three hard problems (pushback)

### Problem 1 — The watch phase: soccer is a low-scoring sport. This is your #1 design risk.

Auto-battlers live or die on the watch phase. TFT combat is 30–45 seconds of *continuous* action: abilities firing, health bars dropping, comebacks visible in real time. A soccer match is 90 minutes in which "nothing happens" most of the time and goals are rare, high-variance events.

Naively simulating a realistic match per round fails on every axis: too long, too boring, and too random (an 8-player lobby where each round is decided by a 0–1 coin flip feels like pure luck, and perceived randomness kills competitive retention).

**You must decide what "a match" means in your game. Candidate models, ranked by recommendation:**

| Model | Description | Pros | Cons |
|---|---|---|---|
| **A. Chance-based highlights** (recommended) | Each round simulates N "chances" (e.g., 6–10 xG-weighted attacks per side). Each chance resolves as a short animated vignette: striker vs defender vs keeper. Score = goals from chances. | Keeps soccer semantics (goals, xG, saves); constant visible action; ~60–90s watch phase; stats are legible and balanceable | Needs a strong chance-generation model; less "real football" feel |
| **B. Compressed continuous match** | 2–3 min stylized real-time match at high tempo (like FIFA Rivals' arcade pace, but hands-off) | Spectacle; clip-worthy | Hard to balance positioning as the key skill; RNG reads as unfair; expensive to build well |
| **C. Abstract resolution** | Match is resolved numerically; you only see a results screen + key stats | Cheap to build; fast | Dead on arrival — removes the emotional core of the genre |
| **D. Turn-based tactics match** (Football, Tactics & Glory-style) | Matches become XCOM-like turns | Deep; proven in indie space | Not an auto-battler anymore; wrong audience; slow |

**Design principles for Model A:**
- Positioning decisions in the build phase must *visibly* cause outcomes in the watch phase ("my winger beat his fallback because I overloaded the left"). If players can't attribute results to their choices, the game dies.
- Damage analog: TFT removes HP per surviving enemy unit. Your analog: **goal difference** deals "morale/points" damage. Concede 3, lose more HP. This preserves the genre's comeback math.
- Every round must produce a "story" — a goal, a save, a red card — even for the loser. Zero-event rounds are churn machines.

### Problem 2 — Licensing: real names are a business-model decision, not a nice-to-have

Your synergy system (club, nationality, league) implicitly assumes real-world football knowledge. Three tiers:

1. **Fully fictional** (players/clubs invented): zero licensing cost, full creative control, but loses the fantasy-draft emotional hook. Top Eleven proves this can work (240M users), but it caps your ceiling and weakens the "combination" system you proposed — "reunite the 2022 Argentina squad" is meaningless with fake players.
2. **FIFPRO collective license**: covers **names/likenesses of 65,000+ real players** via member unions in 70+ countries. This is *attainable* — Dream League Soccer (mid-size studio) and Soccerverse (a small web3 startup, Dec 2025) both hold it. Costs aren't public; expect a meaningful five-to-six-figure annual commitment plus approval processes. **Critically: FIFPRO covers players, NOT club names, badges, kits, or leagues.** German clubs (DFL) and others sit outside it. [Sources: playtoearn.com Dec 2025; majordominates.com DLS licensing explainer]
3. **Club/league licenses**: individually negotiated, expensive, and many are locked up in EA exclusives. Not viable for a new studio at launch.

**Recommended path:** Launch with a **hybrid** — real player names via FIFPRO (if budget allows; it's the single highest-ROI license in football games) + fictional clubs/leagues ("London Reds", "Madrid Whites") that are transparent stand-ins. Your club-synergy trait then works off *fictional club affiliation you assign*, while nationality/position traits work off real data. This is exactly the DLS model. If budget is tight, validate the game fully fictional first and add FIFPRO at soft launch — the mechanic must be proven fun before you pay for names.

### Problem 3 — Match/lobby length and session design

- A standard 8-player TFT game runs 30–45 minutes — fine on PC, hostile to mobile sessions. Riot mitigated with Hyper Roll; Tencent's Chess Rush shipped a 10-minute Turbo mode *at launch* for mobile. Treat a fast mode as **mandatory, not optional**.
- Target: **Standard mode ~20 min, Turbo mode ~10–12 min.** Round timers must be aggressive; the build phase (setting a formation) is slower than TFT's bench-drag because formations are spatially structured.
- Async is a genuine differentiator worth prototyping: football fans are used to checking results. An "Arena" mode where your squad plays X matches per day against other players' snapshots (the AFK Chess model) fits mobile habits better than synchronous 8-player lobbies and dramatically lowers the matchmaking CCU threshold you need at launch — a real survival concern for a new game.

### Smaller but real pushback items

- **Trait legibility**: TFT traits are fantasy abstractions anyone can learn. Your traits are *real-world knowledge* — which is great for football fans (they arrive pre-trained) and bad for everyone else. Decide your audience: this is a game for football fans, full stop. Don't design for the TFT player who doesn't watch soccer; design for the FIFA/Top Eleven player who might try an auto-battler.
- **Real-world churn breaks balance**: transfers, injuries, and form change the meaning of traits mid-season. TFT solves meta staleness with Set rotations every 4–6 months — you get a natural, better analog: **seasons aligned to real football calendars**, with roster updates tied to transfer windows. This is a content advantage over every fantasy auto-battler — but it means live-ops data pipelines (a player-data provider like Opta/Stats Perform or a cheaper API) are a permanent cost from day one.
- **"Position" as a trait is tricky**: most players fit 2–3 positions; rigid position traits feel wrong to fans. Use *position groups* (GK/DEF/MID/ATT) as a core trait axis and *specific roles* (target man, inverted winger, sweeper-keeper) as unit-level abilities.

---

## 4. Gameplay design (full proposal)

### 4.1 Core loop per round (~60–90s)

1. **Transfer window (shop)** — 5 player cards offered from a shared pool, priced 1–5 "transfer budget" by tier. Refresh for 2. Scout (carousel) round every 4 rounds: all players draft one free agent in reverse standings order.
2. **Tactics phase** — drag players onto a pitch diagram (portrait: lower half = pitch, upper half = bench/shop; see §5). Set formation (4-3-3, 4-4-2, 3-5-2…), which constrains where units can be placed. Assign "game plan" items (captain's armband, set-piece taker, pressing trap).
3. **Match phase** — simulated vs one opponent: 6–10 chances per side generated from attack/defense ratings, positioning matchups, and synergy buffs; each renders as a 5–8s vignette. Goal difference determines round damage.
4. **Results & economy** — win/loss streak bonuses, interest on saved budget ("commercial revenue"), injury/fatigue events.

### 4.2 Trait/synergy system (your "combinations", expanded)

Two axes per unit, TFT-style — one "origin", one "class" — plus a third soccer-native axis:

**Axis 1 — Identity (origin):**
- *Nationality* (e.g., Brazil 2/4/6: +flair, +dribble success, chance quality)
- *League* (Premier League, La Liga… — physicality vs technique profiles)
- *Club affiliation* (fictional clubs if unlicensed; enables "reunite the treble winners" chases)
- *Continent* (cheaper, broader thresholds — good early-game trait)

**Axis 2 — Role (class):**
- *Position group*: GK / DEF / MID / ATT
- *Playstyle archetypes*: Target Man, Playmaker, Ball Winner, Speedster, Sweeper, Poacher — with threshold bonuses (e.g., 2 Playmakers: +1 chance per match; 4: chances start from better zones)

**Axis 3 — Chemistry (soccer-native, your differentiator):**
- Direct links between specific units: club teammates, international teammates, "rivals" (small bonus for fielding both sides of a famous rivalry — spicy), manager/player combos. TFT has nothing like this; football fans will theorycraft it obsessively. This is your clip-able, Reddit-able system.

**Threshold design rules:** 2–3 breakpoints per trait (e.g., 2/4/6), always visible in the tactics UI, and every trait must change *visible match behavior*, not just hidden stats.

### 4.3 Progression & meta

- **Sets/Seasons**: every ~4 months, aligned to real football (Aug window, Jan window, post-season international tournaments). Rotating player pool keeps the meta fresh *and* gives you free marketing hooks ("the Transfer Window Set").
- **Star-up**: 3 copies → 2-star, 3×2-star → 3-star, as genre standard. Reskin as "development": 1★ prospect → 2★ first-teamer → 3★ world-class.
- **Items**: boots (attack), armband (leadership aura), gloves, "tactical foul" consumables, set-piece coach (team item).
- **Manager avatar**: your TFT "Little Legend" analog — a touchline manager who reacts to goals. Prime cosmetic monetization real estate.

### 4.4 Modes

- **Ranked Standard** (8-player FFA, ~20 min), **Turbo** (~10–12 min), **Arena (async)**, **Co-op Double Up** (2v2v2v2 — TFT's Double Up retention data suggests this is worth building early), and limited-time event modes tied to real fixtures (e.g., "Champions League week" ruleset).

### 4.5 Monetization (cosmetics-first — do NOT copy Top Eleven's pay-to-progress)

TFT's proof: ~$620M/yr on cosmetics + battle pass alone. Sports-manager games' pay-to-progress model would poison a competitive PvP auto-battler. Recommended stack:
- **Season pass** (primary), **manager cosmetics** (kits, touchline fits, celebrations), **stadium/board skins**, **goal celebration effects** (your "kill FX" analog), **player card frames/foils**.
- Never sell budget/reroll power. One "pay-to-win" scandal in a competitive soccer game and the community torches you permanently.

---

## 5. UX / UI / HCI research & design guidance

### 5.1 What TFT's mobile port teaches (verified pain points)

Reviews of TFT Mobile at launch (IGN Nordic, Mar 2020, and broad player consensus since) document the recurring failures you must design around from day one:
- **Screen real estate**: 9 fielded units + bench + shop + opponent scouting exceeded even a 6.6″ display; Riot had to overhaul the UI, and players still report cramped carousel and repositioning moments.
- **Input precision**: dragging units under time pressure on touch is slower than mouse — players' effective APM drops, so *your round timers must be tuned for thumbs, not cursors*.
- **Performance**: stutter during the busiest visual moment (the watch phase) destroys trust in outcomes. The watch phase must be engineered to hold 60fps on mid-tier Android (the dominant device class in football-mad markets: LATAM, SEA, MENA, Southern Europe).

### 5.2 Your UI is harder than TFT's — plan for it

TFT's board is an abstract 8×7 hex grid; units go anywhere. Your board is a **semantic pitch**: fans will expect a left-back to stand on the left. Formation constraints add UI complexity but also *solve* a real TFT mobile problem — fewer legal placements per slot = fewer drag targets = more forgiving touch input. Lean into that.

**Layout (landscape primary, evaluate portrait early):**
- Landscape is the genre standard and fits a pitch's aspect ratio; portrait is better for mobile habits. This is a genuinely open question — **prototype both in week 1–2 of pre-production**, because it cascades into every screen. (Hypothesis: landscape for matches, portrait for squad management screens, if testing allows mixed orientation.)
- **Tactics screen** (home base): pitch occupies center; shop = bottom sheet; bench = horizontal strip; synergy panel = left-edge collapsible tray showing active traits with thresholds and *what the next breakpoint does*.
- **Thumb-zone rule**: all build-phase interactions in the bottom 60% of the screen. Drag-to-pitch uses raised, haptic-confirmed slots; every drop target ≥ 48dp with magnetic snapping.
- **Scouting opponents** (checking other 7 teams) collapses to a swipeable strip of mini-pitches — this was TFT mobile's most-criticized flow; design it generously.

### 5.3 Onboarding & cognitive load

You inherit a double-teaching burden: auto-battler rules *and* your soccer mapping. Mitigations:
- Football fans already know formations, positions, and rivalries — **anchor every tutorial concept to football vocabulary** ("bench", "starting XI", "transfer budget", "goal difference"), never TFT jargon.
- Trait tooltips must teach football, not assume it ("Inverted Winger: cuts inside to shoot — pair with an overlapping fullback").
- First-session target: user completes one full Turbo match in ≤ 12 minutes with a guided "suggested buy/suggested placement" assist they can ignore.
- D1 retention lives or dies here; top-quartile bar is ~26–28%.

### 5.4 Accessibility & legibility

- Color-blind-safe trait iconography (traits are color + shape + label, never color alone).
- The watch phase must be readable *leaned back at arm's length*: big score bug, chance indicator ("Dangerous attack — left flank"), minimal micro-text. If viewers can't parse a match as a spectator, you also lose the streaming/clip economy that sustains the genre.
- Localization from day one: football is global; launch languages should include at minimum EN/ES/PT/FR/DE/IT/TR/AR/ID.

---

## 6. Competitive positioning

| | Your game | TFT | Top Eleven | FIFA Rivals | FM Mobile |
|---|---|---|---|---|---|
| Core fantasy | Out-draft & out-tactic 7 managers | Out-draft 7 players | Build a club over seasons | Arcade PvP w/ real players | Deep club simulation |
| Session | 10–20 min | 30–45 min | 5–15 min (async-ish) | 3–5 min | 30+ min |
| Skill axis | Drafting + formations + meta | Same | Economy management | Reflexes | Knowledge depth |
| Licensing | FIFPRO (players) optional | LoL IP (owned) | None needed | FIFA + clubs | Some leagues |
| Monetization | Cosmetics + pass | Cosmetics + pass | Pay-to-progress IAP | Gacha + NFT market | Premium/IAP |

**Your wedge:** "The depth of a manager sim in a 15-minute competitive match." No incumbent owns that. TFT won't do soccer; EA won't do FFA auto-battlers (it cannibalizes UT); Top Eleven's owner (Take-Two) could — move while the window is open.

---

## 7. Risks & honest odds

1. **Watch-phase fun risk** (existential): if simulated matches aren't exciting to watch 500 times, nothing else matters. → Kill/validate in prototype, month 2–3.
2. **Matchmaking liquidity**: 8-player synchronous lobbies need CCU depth; empty queues kill new games faster than bad design. → Async Arena mode as retention floor; launch marketing concentrated in 2–3 football-mad regions, not global.
3. **Licensing creep**: pursuing club/league deals before product-market fit will bankrupt you. → FIFPRO-or-fictional only until Series A-scale traction.
4. **Genre fatigue**: auto-battler novelty peaked in 2019–2021. Your pitch must lead with soccer, not with "auto chess but…". UA creatives that look like TFT clones will attract the wrong cohort and churn.
5. **Live-ops burden**: roster data updates, trait balance, sets every ~4 months. Budget a permanent live team from launch, not after.

**Overall odds call:** this is a legitimate, fundable concept *if* the prototype proves the watch phase and *if* you secure either FIFPRO or a genuinely charming fictional universe. Without either, don't proceed.

---

## 8. Full execution plan

### Phase 0 — Validation (Months 0–2, ~1–3 people, minimal spend)
- Paper/Figma prototype of the chance-based match model (Model A). Simulate 1,000 matches with scripted logic (spreadsheet/Python is fine) to sanity-check goal distributions, comeback frequency, and blowout rates.
- 5–10 moderated playtests per week with **football fans who play TFT or FIFA** — recruit from Reddit (r/teamfighttactics, r/FIFA, r/footballmanagergames) and Discord.
- Fake-door test: 3–5 static ad concepts on Meta/TikTok in UK/BR/DE ("Draft your dream XI. Out-think 7 rivals. 15-minute matches.") measuring CTR/IPM as a demand signal. ~$2–5K spend.
- **Gate:** playtesters ask "when can I play more" unprompted; ad CTR at or above mid-core norms. Else pivot the watch-phase model (try Model B) once, then kill.

### Phase 1 — Prototype (Months 2–5, ~4–6 people)
- Unity (recommended: mid-core mobile standard, strong mid-tier Android performance, deep hiring pool) or Godot if team expertise leans that way.
- Single-device build: 1 human + 7 AI opponents, fully fictional players (~60 units, ~10 traits), Turbo mode only, chance-vignette watch phase at 60fps on a mid-tier Android reference device.
- Internal daily playtests; weekly external tests. Measure: matches-per-session, "one more game" rate, watch-phase skip rate (if players skip matches, the spectacle failed).
- Begin FIFPRO exploratory conversations in parallel (slow process; start early).
- **Gate:** 7-day-average session count and qualitative excitement at target; watch-phase skip < 20%.

### Phase 2 — Vertical slice + soft-launch build (Months 5–10, ~8–12 people)
- Real-time multiplayer (authoritative server, Photon/Fish-Net/custom — choose with your backend lead), async Arena mode, season pass scaffolding, cosmetics pipeline, telemetry (retention cohorts, economy funnels, trait win-rates).
- Art direction lock: stylized (think TFT's readable charm), not realistic — realism is EA's game and a rendering budget you don't have.
- **Gate:** internal D1/D7 simulations via expanded playtests; economy model balances in Monte Carlo.

### Phase 3 — Soft launch (Months 10–14)
- Phase A (technical, 2–4 wks): Philippines/Vietnam/Colombia, $20–50K — stability, tutorial completion, D1.
- Phase B (behavioral, 4–6 wks): + Canada/Australia/Netherlands, $100–250K — D7, ARPDAU, payer conversion. **Decide here whether the economy works.**
- Phase C (marketing, 4–6 wks): Tier-1 at 20–40% spend, $300K–1M — D30, D60 ARPU, creative scalability.
- FIFPRO decision point: sign if Phase B metrics hold.
- **Gate (industry-standard):** D1 ≥ 26%, D7 ≥ 7%, D30 ≥ 3%, D7 ROAS ≥ 4–5%, LTV:CAC path to ≥ 3:1 by D180.

### Phase 4 — Global launch & live ops (Month 14+)
- Global launch timed to a football calendar spike (season start, Jan window, or a World Cup/Euro summer).
- Live ops cadence: balance patch biweekly, Set every ~4 months synced to transfer windows, event modes synced to UCL knockouts/internationals.
- Esports-adjacent: creator tournaments early (auto-battlers grow through streamers; TFT's ecosystem is the model), formal esports only if ranked population supports it.

### Team & budget (order-of-magnitude, indie/mid-core)
- Core team at vertical slice: 1 game director/designer, 1 systems designer, 2–3 Unity engineers, 1 backend engineer, 1 UI/UX designer, 1–2 artists, 1 producer (fractional early), QA via playtest panels until soft launch.
- Burn to global launch: roughly **$1.5–3M** including soft-launch UA, excluding FIFPRO. A publisher or a football-data/brand partner (clubs, broadcasters, sportswear — note FIFA Rivals' adidas deal) can de-risk both licensing and UA.

### First two weeks (concrete next steps)
1. Write the one-page match-model spec (chance generation, xG weighting, damage math).
2. Build the spreadsheet/Python match simulator and run the distribution sanity checks.
3. Recruit 15 playtesters from TFT/FIFA communities.
4. Sketch both portrait and landscape tactics-screen wireframes.
5. Send the exploratory FIFPRO licensing inquiry.
6. Draft 3 fake-door ad concepts and book the $2–5K test budget.

---

## 9. Key sources

- TFT player/revenue estimates — rec0ded88.com live player count (Jul 2026); third-party estimates, directional only
- TFT mobile launch performance — GamesBeat / Sensor Tower
- Auto-battler market sizing — Growth Market Reports (Aug 2025), Dataintelo (Sep 2025), WiseGuyReports (Jul 2026)
- Mobile sports/midcore landscape — InvestGame Mobile Market Landscape 2026
- Top Eleven scale & monetization — Take-Two/Nordeus acquisition release (Jun 2021); GameDeveloper Nordeus interview
- FIFA Rivals performance — games.gg, blockchaingamer.biz, The Defiant (2025–2026)
- FIFPRO licensing precedents — Soccerverse/FIFPRO deal coverage (playtoearn.com, egamers.io, Dec 2025); DLS licensing explainer (majordominates.com)
- UA/retention benchmarks — Admiral Media Mobile Game Marketing Benchmarks 2025; GameGrowthAdvisor Midcore Strategy 2026; Playio/GameAnalytics engagement benchmarks
- TFT mobile UX pain points — IGN Nordic hands-on (Mar 2020); Digital Trends launch coverage
