# Tactics FC — Platform & Audience Strategy: Change the Order, Not the Audience

**Status:** Strategy analysis (v1) — answers: "Mobile users won't mod. Do we change the target audience or the strategy?"
**Date:** 2026-07-31

---

## 1. The short answer

**Change neither. Change the *sequencing*.**

- **Same audience:** casual/midcore football fans — you still reach them, just later.
- **Same strategy:** fictional-first → license later → sell at soft launch.
- **Different beachhead:** launch on **PC/Steam first**, where the auto-battler-literate audience, the free discovery channels, and the mod ecosystem already exist. **Mobile becomes the scale phase**, entered only after you have (a) proven retention, (b) revenue or funding, and (c) ideally the FIFPRO license that makes mobile marketing work.

The mistake in the original plan wasn't the audience — it was assuming mobile is the *first* platform. For a two-person team with $0 and no marketing skill, **mobile-first is the single hardest path in the industry.** The evidence:

- Midcore/strategy mobile CPIs run **$2–4.50 on Android, $3.50–6.50 on iOS**, and realistic soft-launch UA budgets for the genre are **$420K–1.3M**. Without that spend, an unlicensed, unknown-IP soccer strategy game is invisible in the stores.
- Mobile store discovery is a lottery dominated by paid UA and platform featuring — and Apple/Google feature games with strong brands or polish, not zero-budget debuts with unpronounceable invented players.
- The games that *did* break out on mobile with tiny budgets (Top Eleven in 2010, Super Auto Pets in 2021–22) did so when competition was a fraction of today's — and Super Auto Pets actually **started on Steam/itch.io**, got big there, *then* ported to mobile.

**The hard truth you should internalize now: "lots of users quickly with no marketing skill" does not exist on any platform.** What *does* exist is a platform where non-marketers have a structural chance — and that platform is Steam.

---

## 2. Why Steam is the beachhead: the Super Auto Pets precedent

Super Auto Pets is almost a perfect rehearsal of your situation:

| Dimension | Super Auto Pets | Tactics FC |
|---|---|---|
| Team | Tiny indie (Team Wood Games) | Two founders |
| Marketing skill/budget | ~None; grew via streamers & word of mouth | None |
| Characters | Fully fictional (cartoon animals) | Fully fictional (decodable footballers) |
| Core mechanic | Auto-battler with synergies | Auto-battler with synergies |
| Platform order | **Steam/itch.io first → mobile after success** | Proposed: same |
| Mobile result | **1M+ Android downloads** via organic porting | The prize |
| Monetization | F2P + paid expansion packs | Options below |

Key lesson: **the fictional characters were not the bottleneck — discovery was, and Steam solved discovery for free.** Streamers picked it up because auto-battler content performs well on Twitch/YouTube; the audience that watches that content already understands synergies, positioning, and "broken combos," so a fictional cast was instantly legible.

### Steam's free discovery stack (no marketing skill required)

1. **Steam Next Fest demos.** Even weak performers pick up hundreds of wishlists; solid demos get thousands. Steam reports a **1,364% median lift in daily wishlist additions** during Next Fest. This is a scheduled, free, merit-ish exposure event — you just need a good demo by the deadline.
2. **Streamer/YouTube organic.** Auto-battlers are a proven content genre. Streamer-referred traffic converts **10–20%+** better than paid impressions. Your pitch to streamers writes itself: "TFT but football."
3. **Steam's algorithm.** Wishlist velocity → "Popular Upcoming" → launch featuring. ~7–10K wishlists is the minimum launch floor; 25–50K is the sweet spot. This loop runs on game quality and demo conversion, not ad spend.
4. **Steam Workshop.** The option-file/mod bridge that doesn't work on mobile **works natively here** — one-click subscription to a "real names + badges" community file. You never ship it, never host it, never endorse it; the community does what PES and FM communities have done for decades.

---

## 3. The Mechabellum option: premium pricing funds the license

Mechabellum — another small-team auto-battler with no license, no IP, and generic fictional units — sold **~500K–1M copies on Steam** (est.) at a premium price point, grossing several million dollars.

This unlocks a funding path that doesn't depend on VC:

```
Steam premium sales ($12–15) at even 30–50K units
  → $250K–500K net after Steam's cut
    → pays for FIFPRO license + mobile port + first UA tests
      → mobile launch with REAL players + funded marketing
        → the Top Eleven-scale audience you wanted all along
```

Compare: a mobile F2P launch with $0 earns ~$0 until you spend six figures on UA. **Premium Steam pricing converts your small early audience into capital.** You can also go hybrid: premium on Steam, F2P with expansions on mobile later (Super Auto Pets' exact model, minus the head start).

---

## 4. What changes in the design (and what doesn't)

Nothing about the core game changes. The game loop doc stands: Transfer Window → Tactics Board → Match (Turbo/spectator timeline) → Results. Platform sequencing only changes mode priorities and packaging:

1. **Async PvP becomes the primary competitive mode from day one** (Super Auto Pets' Arena model: you play against *snapshots* of other players' squads, not live opponents). This solves the matchmaking-liquidity death spiral that kills live-PvP indie games at low player counts — on every platform, mobile included later. Live 8-player lobbies can wait or remain a secondary mode.
2. **Single-player vs AI must be genuinely good** — it's what sells a premium Steam game and what playtests the sim.
3. **Steam Workshop support** for squad-data files (the mod bridge) — a data-import feature, cheap to build because names/portraits/traits are already a pure data layer (Phase 0 architecture rule).
4. **Mobile-specific UX work is deferred, not cancelled** — the design doc's mobile-first 60/30/15-second experience tiers still govern the *match UX*, because Turbo mode and snackable matches are right on every platform.

---

## 5. Honest risks of the Steam-first path

- **Steam auto-battler fatigue is real.** Mechabellum and Super Auto Pets succeeded; dozens of auto-battlers shipped to <1,000 reviews. Your differentiator is football (no successful football auto-battler exists on Steam), but execution quality decides everything.
- **Premium pricing raises the quality bar.** Players refund <2 hours in. The sim must feel fair and the watch phase must be fun *before* Next Fest.
- **The football audience on Steam skews to FM/EAFC players** — management-sim literate, which fits, but the casual TikTok football fan arrives later on mobile. Fine: sequencing, remember.
- **Streamer coverage isn't guaranteed** — but "TFT but football" is one of the most instantly communicable pitches in the genre, and streamers need exactly that kind of hook.
- **Timeline extends** the mobile payday by ~12 months. The alternative is a mobile launch that likely never gets users at all.

---

## 6. Decision framework recap

| Question | Answer |
|---|---|
| Change the audience? | **No.** Casual football fans remain the endgame market. |
| Change the strategy? | **No.** Fictional-first → license → exit stands. |
| Change the platform order? | **Yes.** Steam beachhead → mobile scale phase. |
| Change the monetization? | **Add Steam premium ($12–15) or F2P+expansions; mobile F2P unchanged.** |
| Change the PvP model? | **Yes.** Async snapshot PvP primary; live lobbies secondary. |

---

## 7. Revised phase map (amends the strategy memo)

| Phase | Was | Now |
|---|---|---|
| 0 (0–3 mo) | Sim + playable, fictional players | Same — **but target PC build + web demo from day one** |
| 1 (3–8 mo) | Web/TestFlight beta, 500-user retention gate | **Steam demo + Next Fest entry**; gate = demo wishlist velocity + playtest retention; async PvP live |
| 2 (8–12 mo) | Raise pre-seed | **Steam launch (premium or F2P+expansions) OR raise on Steam metrics** — revenue makes the raise optional |
| 3 (12–20 mo) | License FIFPRO, soft launch mobile | Same — now funded by Steam revenue; mobile gets real players + funded UA; fictional clubs forever |
| 4 (20–36 mo) | Acquisition process | Same — buyers (Take-Two/Zynga, Scopely, Sorare, Mythical, GALA) now see PC retention *and* mobile ARPU |

Kill criteria unchanged: 3 failed watch-phase iterations → stop; failed raise → stay fictional and indie; never buy real players with unlicensed infringement.

---

## 8. Sources

- Super Auto Pets player counts, platform history, monetization: Steam/SteamDB estimates, web search results (2024–2026)
- Mechabellum sales/revenue estimates: SteamSpy, games-stats.com, Video Game Insights (accessed 2026-07-31); treat as estimates
- Steam Next Fest wishlist lift (1,364% median), wishlist floors: Valve/GameDiscoverCo reporting
- Mobile CPI and soft-launch UA budgets: Business of Apps, Udonis, Sensor Tower roundups (2025–2026)
