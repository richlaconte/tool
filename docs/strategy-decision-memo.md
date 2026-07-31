# Strategy Decision Memo — Tactics FC (Soccer Auto-Battler)

**Date:** 2026-07-31
**Inputs:** Product/market research (`soccer-auto-battler-research-plan.md`), legal research (`player-name-likeness-legal-research.md`, incl. EA/Konami/FM playbooks §6.5)
**Constraints stated by founders:** (1) desired exit = acquisition by EA or similar; (2) effectively zero budget; (3) willing to incorporate (LLC) for liability protection.

---

## 1. The decision (one paragraph)

**Build the game fully fictional, architected so real-player data can be injected later, prove retention with a $0-cost prototype and beta, raise a small pre-seed on that data, buy FIFPRO only after funding, and target acquisition by a mid-tier sports/mobile publisher (not EA) at the soft-launch-to-global-launch stage.** Do not use real player names or likenesses at any point before the FIFPRO license is signed. Form an LLC — but for contracts and app-store reasons, not as a lawsuit shield.

---

## 2. Pushback on your three assumptions

### 2.1 "We'd love to get bought by EA" — right goal, wrong buyer, wrong stage

EA does not acquire concepts, prototypes, or pre-revenue indie games. EA's acquisitions are purchases of *proven revenue and audiences*: Glu Mobile (~$2.1B, 2021), Playdemic/Golf Clash (~$1.4B cash, 2021 — bought only after years of top-grossing performance), Codemasters ($1.2B). Nordeus (Top Eleven) sold to Take-Two only after **240M registered users**. Additionally, EA itself is mid-takeover (the 2025–26 take-private), which makes small speculative acquisitions less likely, and — most importantly — **EA's moat is its licensing web, so a no-license soccer game has negative strategic value to them**: if your game ever threatens them, they out-license and out-market you; they don't buy you.

**What acquirers actually buy, in order of importance:**
1. **Retention & revenue data** (D7/D30, payer conversion, organic growth) — proof the mechanic works
2. **A live, growing player community**
3. **A team that can execute**
4. **Clean IP** — see §2.2; a legally encumbered game is *unacquirable*, full stop. Due diligence kills the deal.

**Your realistic acquirer map** (companies that buy or build exactly this category):
- **Take-Two / Zynga** — owns Nordeus (Top Eleven); the single most natural strategic buyer for a soccer management/battler hybrid
- **Scopely, Miniclip (Tencent), Tilting Point, Voodoo** — buy proven mid-core/hybridcasual titles
- **Mythical Games** (FIFA Rivals, NFL Rivals) — has FIFA licenses, wants more sports gameplay depth
- **Sorare** — holds FIFPRO + club licenses already; a fun auto-battler game layer on their cards is strategically coherent
- **GALA Sports (HK-listed)**, other Asian mobile-sports publishers — explicitly license FIFPRO + clubs and acquire/built titles
- **Sports-data/virtuals companies** (Stats Perform, Genius Sports, Leap Gaming) — already sell soccer sims with altered names to betting operators
- **EA/Konami/SEGA** — possible only at a much larger scale than any of the above requires; treat as a lottery ticket, not a plan

### 2.2 "LLC to secure ourselves from lawsuits" — form it, but don't let it change a single design decision

- **What an LLC does:** shields personal assets from *contract* and *business-debt* liability; gives you an entity for app-store accounts, hiring, and a future license agreement. Costs little. Form it early. ✅
- **What it does NOT do:** it does not make unlicensed player use "viable," for three reasons:
  1. **The real kill shot is an injunction, not damages.** A rights-holder doesn't need to bankrupt you — they get a court order/app-store takedown and your game is gone. The company was the asset; shielding your house doesn't save the company. (See EA forced to strip Maradona for 3 years; Konami renaming Bayern overnight.)
  2. **Veil-piercing and direct liability exist.** Founders who personally direct infringing acts can be named personally, especially in IP cases where the infringement *is* the business model. An LLC whose entire product is infringement is not much of a veil.
  3. **It poisons the exit.** No acquirer will buy a game whose core content is unlicensed likenesses. You'd be spending your one asset (the product) to protect assets you don't have (personal wealth), while destroying the outcome you actually want (acquisition).
- **Verdict:** LLC = yes, hygiene. LLC-as-permission-slip = no, and this plan assumes real players are never touched pre-license. (Not legal advice — run the final structure past an attorney; it's a ~1-hour consultation.)

### 2.3 "No budget" — this actually *forces* the right strategy

Zero budget eliminates the two biggest ways to fail (paying for licenses before fun is proven; buying users before retention is proven). It also means **the fictional-first decision is made for you**, and it's genuinely the right one:

**The genre's #1 game proves fictional works.** TFT — the game you're modeling — uses *invented* characters (LoL champions). No auto-battler needs real humans to be fun; real players in your design are a **marketing accelerant**, not a gameplay requirement. Meanwhile the most successful soccer manager mobile game ever, Top Eleven, reached 240M users with **fictional players**. Both of your parent genres succeed without real names. What nobody has proven is the soccer-auto-battler *mechanic* — that's your risk, and it costs $0 in licenses to test.

---

## 3. The plan

### Phase 0 — Prove the fun (Months 0–3, ~$0–500)
- Build the match-model simulator (spreadsheet/Python) from the research plan's Model A (chance/xG-based vignettes). Tune goal distributions.
- **Design the player universe as fictional-but-decodable:** invented players with football-native traits (nationality-flavored regions, archetype roles, club-like "houses"). Fans should be able to *feel* "that's clearly a target man / that's clearly a Brazilian-style winger" — the trait system carries the football flavor without a single real name.
- 15–25 playtesters from TFT/FIFA/FM communities; Discord community from day one.
- **Architecture requirement (this is the whole exit strategy):** player/club/league names, portraits, and trait tags are pure data layers over the sim engine. Swapping "Player X, House of Albion" for a FIFPRO-licensed real player must be a data import, not a code change. This is what you demo to acquirers.
- **Gate:** playtesters self-organize repeat sessions; "one more game" behavior. Fail → iterate the watch phase once → kill if still flat.

### Phase 1 — Playable beta (Months 3–8, ~$0–2K, nights-and-weekends viable)
- Single-device Unity/Godot build: 1 player + 7 AI, Turbo mode only, stylized original art (FM-newgen logic: charming generated/stylized characters, zero resemblance to real humans).
- Free distribution: web/PWA build + TestFlight/Play internal track; organic-only marketing (TikTok clips of the watch phase, Reddit, Discord). Zero paid UA.
- Instrument retention from the first build (even crude: returning sessions per user).
- **Gate:** D7-equivalent behavior trending toward 7–10% on a few hundred organic users; watch-phase skip rate < 20%.

### Phase 2 — Raise small, license smart (Months 8–12)
- Raise **$250–750K pre-seed** (games angels, pre-seed funds, or a strategic: Sorare/Mythical/data companies are plausible *investors*, not just acquirers) on the Phase 0–1 data + the licensing-ready architecture demo.
- First spend priorities: (1) 1 hour of sports-IP counsel to bless structure + LLC; (2) FIFPRO Commercial Enterprises engagement (expect months of lead time); (3) one strong artist + one engineer.
- **Do not** buy UA yet. **Do not** announce "real players coming" until FIFPRO signs — marketing with player names pre-license is the 🔴 16/25 risk in the legal memo.

### Phase 3 — Licensed soft launch (Months 12–20)
- Inject FIFPRO real names via the data layer (fictional clubs stay fictional — the Konami playbook; fans forgive fake clubs, never fake players).
- Phased soft launch per the research plan ($ targets from that doc): technical → behavioral → marketing gates. Brazil/Argentina content decisions only with local counsel (strictest jurisdictions; both EA and Konami lost there).
- **Gate:** D1 ≥ 26%, D7 ≥ 7%, credible LTV:CAC path — the same metrics an acquirer's diligence team will read.

### Phase 4 — Scale or sell (Months 20–36)
- **If metrics are strong:** you now have the thing acquirers buy — proven retention, a live community, FIFPRO-clean IP, and a data architecture that any strategic (Take-Two, Scopely, Sorare, Mythical, GALA) can scale with their licenses and UA budgets. This is the moment to run a process: take inbound interest, get 2+ parties talking, sell between soft launch and global scale-up. Comparable outcomes in this exact space: Nordeus → Take-Two; Playdemic → EA ($1.4B); Scopely's string of acquisitions. Realistic window for a good-not-great outcome: **$10–60M**; great outcomes go higher.
- **If metrics are mediocre:** sell earlier, as a team + tech + community acqui-hire to a sports publisher, or keep it as an indie business.

**Honest timeline:** Nordeus took ~11 years from founding to exit; Playdemic ~11 years. Plan for 3–5 years minimum, and treat anything faster as luck.

---

## 4. Design decisions this strategy locks in

1. **Fictional players at launch; real players only post-FIFPRO.** No exceptions, no gray-zone flirtation — your zero legal budget makes the yellow zone unaffordable, not just risky.
2. **Fictional clubs, permanently** (Konami model) — top club licenses are locked in EA/Konami exclusives; make fictional clubs lovable (fans decoding "Albion Rovers" is engagement, not a compromise).
3. **Names/portraits/traits as a pure data layer** — the single most important engineering decision; it *is* the acquisition pitch.
4. **Original stylized art only** — never recognizable as a real human; never real photos (dual copyright + personality clearance problem).
5. **A rename/suspend pipeline from day one** (EA's Maradona mechanism; FM's "Man UFC") — cheap to build early, existential later.
6. **Cosmetics + season pass monetization** (TFT model), never pay-to-win — competitive integrity is what makes the title acquirable.

## 5. Kill criteria (write them down now)

- Phase 0: playtesters don't self-return after 3 iterations of the watch phase → stop.
- Phase 1: can't reach 500+ organic users with any retention signal → stop or pivot to a pure single-player puzzle-manager concept (cheaper to finish, sellable on Steam/mobile premium).
- Phase 2: can't raise on Phase 1 data → stay fictional, monetize indie, or fold. **Never "solve" a failed raise by using real players without a license.**

---

## 6. One-paragraph honest summary

The version of this plan where you use real players without a license behind an LLC has only bad endings: best case the game stays small and unsellable; worst case an injunction kills it and names the founders. The version where you prove the mechanic with fictional players costs almost nothing, tests the *actual* risk (is the watch phase fun?), and produces the only asset acquirers pay for — working retention on clean IP. EA is not your buyer at any realistic scale; Take-Two/Zynga, Scopely, Sorare, Mythical, or an Asian mobile-sports publisher is. Form the LLC for hygiene, build fictional, architect for license injection, raise on retention data, license second, sell third.

---

## 7. Amendment: preserving the "Messi + Haaland" dream-pairing appeal at $0

**Founder challenge (valid):** fictional players sacrifice the fantasy-draft moment — "I paired Messi with Haaland and destroyed them" — which is half the emotional hook and the cheapest marketing creative imaginable. Accepted: fictional-first is the plan's single biggest product sacrifice. Here is the honest accounting and the mitigation.

### 7.1 What is NOT a solution — the soundalike trap

Do **not** ship "M. Essi" / "Halaand" / "Kyle Muabbey"-style near-identical fake players:

- **Legally it's worse, not safer.** The US cases (Hart/Keller) punished *recognizable identity without names attached*. A soundalike name + correct nationality + correct position + correct stats is still that player's identity — and the thin disguise documents *intent to appropriate*, which reads terribly in front of a judge and in acquirer diligence.
- **Commercially it's mocked.** Outlets openly ridicule soundalike rosters ("playing with a slightly off-putting version of Kylian Mbappé named Kyle Muabbey"). It signals "bootleg" to exactly the fans you're courting.
- Rule: either a player is clearly fictional (own name, own identity) or licensed-real. Nothing in between.

### 7.2 The proven $0 route: the PES/FM mod playbook (option files)

Konami shipped "Man Blue" for 25 years while millions of players enjoyed fully real clubs — because PES had an **Edit Mode** and the community distributed **option files** (data packs with real names/kits) that users imported themselves. Football Manager's ecosystem does the same: DF11's 250,000-face megapack, real-name fixes for unlicensed national teams. The publisher never ships or hosts the infringing content; the community creates and shares it; the game is merely *editable*.

**Translation for Tactics FC (Phase 1 feature, explicitly added to the plan):**

1. Ship the official game 100% fictional.
2. Build a **robust player/team editor** + **importable data format** (share codes or JSON import) from day one — it's the same "data layer" architecture the exit strategy already requires, just exposed to users.
3. Let the community build and circulate real-player databases on *their* channels (Discord, Reddit, spreadsheets). You don't create it, preload it, advertise it, or host a repository of it. If you ever host user uploads, you inherit notice-and-takedown obligations — keep the official channels clean.
4. Marketing, store pages, and ads remain fictional-only, forever, until FIFPRO signs.

**Legal posture honesty:** this is the documented industry norm (PES option files, FM facepacks have operated openly for 15–25+ years without publishers being sued over them), but it is "tolerated precedent," not a statute. The bright lines that keep it defensible: you never ship the content, never imply endorsement, and you respond to any takedown demand instantly. This is a counsel-review item in Phase 2, not a founder judgment call.

### 7.3 Making fictional players earn attachment (so the wait hurts less)

The pairing fantasy is ultimately about *attachment to characters* — TFT proves attachment to invented units ("my Jinx/Vi combo") carries an auto-battler. Accelerate attachment deliberately:

- **Strong archetype identity:** players should be recognizable *as types* in one glance ("the mercurial left-footed 10," "the Nordic goal cyborg") — decodable without being identifiable individuals (§7.1's bright line).
- **Star-up = character arc:** 1★ prospect → 3★ world-class with name chants, portrait glow-ups, signature vignettes. Players fall in love with who a unit *becomes*.
- **Persistent lore:** your fictional houses/clubs get identities, rivalries, and histories — the trait system's chemistry links double as storytelling.
- **Replayable moments:** post-match share cards ("Your 3★ captain scored a 92' winner") give fictional players the clip economy that real stars would have provided.

### 7.4 The reframe

The fictional era is **not the product — it's the down payment on the real-player product.** The plan already injects real names at Phase 3 (post-raise, FIFPRO-signed). The question was never "fictional or Messi?" — it's "Messi now with injunction risk and zero budget, or Messi in month 12–20 as a funded, licensed, acquirable game." The option-file playbook (§7.2) bridges the emotional gap in the meantime at $0, using the exact mechanism Konami and Sports Interactive have relied on for decades.
