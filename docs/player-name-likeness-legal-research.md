# Legal Research: Using Real Soccer Player Names & Likenesses in a Mobile Game

**Date:** 2026-07-31
**Matter:** Soccer auto-battler mobile game ("Tactics FC" working title) — use of real player names (e.g., "Messi") and player likenesses/images
**Status:** Research memo — **not legal advice**. Any launch decision should be reviewed by qualified games/sports IP counsel in the target markets.

---

## 0. Bottom line up front

- **Using real player *names* (text only, with stats)** sits in a contested gray zone: tolerated in some jurisdictions (US fantasy-sports precedent), actionable in others (Brazil, Argentina). Risk: **YELLOW** — survivable with design mitigations and legal review, not risk-free.
- **Using real player *likenesses* — photos, photorealistic models, or recognizable avatars — without a license is a RED-zone risk virtually everywhere.** Every major publisher (EA, Konami) licenses; every litigated case where a publisher didn't license, they lost or settled (Hart, Keller, Davis, Brazil PES/EA cases).
- **The industry-standard fix is a FIFPRO group license** (65,000+ players) — affordable enough that a small web3 startup (Soccerverse, Dec 2025) holds one. But FIFPRO has documented gaps: legends/deceased players, opt-outs, wrong-party risk, and at least one national court (São Paulo) ruling that collective authorization does **not** replace individual consent.
- **Trademarks are a separate trap**: "MESSI", "CR7", Mbappé's 15 marks (including his celebration silhouette), club names (Man Utd sued Football Manager). Never use player names in your game title, store listing, or ads.
- **Real photos carry a second, independent copyright** belonging to the photographer/agency — licensing the player is not enough (Rihanna v Topshop).

---

## 1. The four distinct legal rights in play

Using "Messi" in your game potentially implicates **four different bodies of law**, each with different owners and defenses:

| # | Right | What it protects | Who owns it | Key statutes/cases |
|---|---|---|---|---|
| 1 | **Right of publicity / personality rights / image rights** | Commercial use of name, likeness, nickname, voice, signature, identifiable characteristics | The player (or their image-rights company — e.g., Dybala's was held by a third party and killed a 2019 transfer) | US: state law (CA, NY, IN…); Brazil: Constitution art. 5 + Pelé Law art. 87-A; France/Germany: civil personality rights; **UK: none (see §4.4)** |
| 2 | **Trademark** | Registered player brands: MESSI (9 EU marks), CR7/CR9, Mbappé ×15 (incl. celebration silhouette), Lamine Yamal ×7 ("304"), "Cold Palmer" motion mark — plus **club** names/crests | Players' brand companies; clubs | CJEU *EUIPO v Messi* (C‑449/18 P, 2020); *Man Utd v Sega/SI* (2020–21) |
| 3 | **Copyright** | The actual photograph or footage of the player | Photographer / agency (Getty, Reuters) — **not** the player | *Fenty v Arcadia (Rihanna v Topshop)* [2015] EWCA Civ 3 |
| 4 | **Data protection** | Processing of personal data (name + attributes) | N/A — regulatory | GDPR/UK GDPR (low risk for public-figure sports data, but not zero) |

A license from one rights-holder does **not** clear the others. This is the single most common failure mode in the case law.

---

## 2. Precedent file (what actually happened to others)

### 2.1 US: unlicensed realistic avatars lose — *Hart*, *Keller*, *Davis* v. EA
- EA's *NCAA Football* used avatars matching real college players (appearance, number, position, biographical details) **without using their names**. Courts still found right-of-publicity violations: *Hart v. EA* (3d Cir. 2013), *Keller v. EA* (9th Cir. 2013), *Davis v. EA* (9th Cir. 2015, retired NFL players in *Madden*).
- The governing test is **transformative use**: a realistic avatar of a real athlete doing what the athlete really does is *not* transformative — "digitalization, without something else, is not transformation." EA settled for **$40M** and cancelled the NCAA series; the Supreme Court declined to rescue *Davis*.
- **Direct read-across**: a recognizable in-game model of Messi playing soccer, even with a stylized art style and *even without his name attached*, is precisely the fact pattern that lost in these cases. "It's a cartoon, not a photo" is not a defense.

### 2.2 US: names + stats alone have a partial safe harbor — but it's a circuit split
- *C.B.C. Distribution v. MLB Advanced Media* (8th Cir. 2007, cert. denied 2008): fantasy baseball operator could use player **names and statistics without a license** — First Amendment interest in publicly available facts outweighed publicity rights. Key factors: no pictures used, no implied endorsement, names used alongside data, not as branding.
- *Daniels v. FanDuel* (Indiana Supreme Court 2018): DFS use of names/likenesses/stats fell within the "newsworthy value" exception of Indiana's statute.
- **Counter-precedent**: *Gridiron.com v. NFL* rejected the First Amendment defense and found commercial exploitation. The right of publicity is **state-by-state** in the US — there is no uniform rule, and no US case blesses *likenesses* in a full video game (only *Cardtoons*, 10th Cir. 1996, protected cartoon parody baseball cards on parody/commentary grounds — a defense posture you don't want to need).

### 2.3 The Zlatan/Bale revolt (2020) — the collective-licensing fault line
- Nov 2020: Zlatan Ibrahimović — *"Who gave FIFA EA Sport permission to use my name and face? @FIFPro? … I never allowed FIFAcom or Fifpro to make money using me."* Gareth Bale joined ("what is @FIFPro?"). Agent Mino Raiola claimed **300+ players** were considering legal action.
- EA's position: rights acquired from **leagues, clubs, FIFPRO, and individual players**; called it "a battle between football agents and FIFPRO," not EA.
- Structural weakness exposed: the **Premier League standard player contract** grants the club image use "in a Club Context" for club/league promotion — it is genuinely debatable whether that wording authorizes sublicensing into a video game. Players often sign away image rights to clubs (or to their own image-rights companies) without realizing the downstream scope.
- Resolution: no mass lawsuit materialized; EA extended its long-term FIFPRO deal (Oct 2021). But the episode proves the chain of title has weak links that determined stars can pull on.

### 2.4 Brazil: collective authorization ≠ individual consent
- São Paulo Court of Appeal (2018, *PES* case, suit no. 1126481-26.2016.8.26.0100): Konami's contracts with the player's **team and FIFPRO did not substitute** for the player's individual authorization; damages awarded (~USD 11k to one player).
- 2020: Brazilian players won a **R$6.5M (~US$1.18M) settlement** against EA over FIFA image use (reported by BBC via SportsPro).
- Brazil is arguably the strictest major football market: image rights are constitutional personality rights (Pelé Law art. 87-A). **If you launch in Brazil with real names/faces and no individual-clearance strategy, you are the defendant in a case plaintiffs have already won twice.**

### 2.5 Argentina: the Maradona saga — wrong-party risk even when you *do* pay
- EA licensed Maradona's image via his former manager Stefano Ceci. An Argentinian court (2021) found Ceci **lacked authority**; EA was forced to **remove Maradona from FIFA 22** (Mar 2022) mid-season.
- Parallel trademark war: lawyer Matias Morla's company Sattvica claimed the "Diego Maradona" marks; Maradona's daughters fought back; EUIPO dismissed Sattvica's claim (final appeal failed Nov 2023). EA negotiated with the heirs and restored Maradona in **EA FC 25 (Feb 2025)** — a **three-year removal**.
- Lessons: (a) **legends/deceased players are NOT in FIFPRO** — estates license individually, and estates fight internally; (b) paying *someone* is not enough — verify chain of title with warranties; (c) your content pipeline needs a "suspend player" mechanism, exactly like EA's.

### 2.6 Club names are trademarks too — *Manchester United v. Sega/Sports Interactive*
- 2020: Man Utd sued Football Manager's publisher over use of the club **name** (a registered EU trademark) beside a generic red-and-white crest. Sega argued "legitimate reference in a football context" and 28 years of unchallenged use — but **settled (Aug 2021)** and renamed the club "Manchester UFC" (later "Man Red") in-game until a 2023 Premier League licensing deal restored the real name.
- Implication for your synergy system: **"club membership" traits using real club names/badges are a separate licensing layer from player rights** (and many club licenses are locked in EA/Konami exclusives — e.g., Juventus became "Zebre"/"Piemonte Calcio" under Konami exclusivity).

### 2.7 UK: no image right at all — but passing off bites on implied endorsement
- *Fenty v Arcadia (Rihanna v Topshop)* [2013] EWHC 2310 (Ch), upheld [2015] EWCA Civ 3: English law has **no freestanding image right**. Rihanna won only on **passing off** — and only because the specific photo resembled her album marketing and Topshop had cultivated celebrity associations, so buyers likely thought the shirt was *authorized*.
- Also note: Topshop **had licensed the photo from the photographer** — and still lost. Copyright clearance ≠ personality clearance.
- Practical meaning: in the UK, unlicensed *merchandising-style* use is hard to stop, but anything that **implies endorsement** (store art, ads, "featuring Messi!") creates passing-off exposure — and trademark claims where marks exist.

### 2.8 Trademark precedents on player names
- *EUIPO v Messi* (CJEU, Sep 2020): Messi fought **10 years** to register MESSI over MASSI — he won, confirming top players actively register and police name marks (Messi holds 9 EU marks; CR7 is a US-registered mark; Mbappé has 15 including his goal-celebration silhouette; Cole Palmer has a "Cold Palmer" motion mark).
- Consequence: using "Messi" *in game content* is one thing; using it **in your game's title, app-store keywords, icon, or ads** invites trademark + false-endorsement claims (cf. *Arsenal FC v Reed* — clubs win these).

---

## 3. The FIFPRO license: what it is and where it leaks

**What it is:** FIFPRO (via FIFPRO Commercial Enterprises) is the global union umbrella for ~65 national player associations representing **65,000+ professionals**. It sells **group licenses** for members' names/images — the mechanism behind EA FC (17,000+ players), eFootball, Dream League Soccer, Sorare, and Soccerverse (Dec 2025 deal). FIFPRO's own guidelines state a player's name/image "may only be commercially utilised with his or her consent, voluntarily given" — the collective works because members delegate that consent through their unions.

**Attainability:** confidential terms, but the presence of mid-size studios (First Touch Games/DLS) and startups (Soccerverse) proves it is not EA-priced. Expect meaningful annual fees, an approval process, and marketing/asset-approval obligations.

**Known gaps and leak points:**
1. **Legends & deceased players** — not covered; negotiate with estates (Maradona, Beckenbauer, Pelé all handled individually).
2. **Players outside member unions** — coverage depends on the national union being a FIFPRO member; verify your target leagues are in-scope.
3. **Individual carve-outs** — stars with their own image-rights companies or side deals (the Dybala structure) may fall outside the collective grant.
4. **Brazil** — a national court has held the collective grant does not substitute individual consent. You need a Brazil strategy (local counsel, possibly union-level or individual clearances, or geo-differentiated content).
5. **No club rights** — FIFPRO covers players, not club names, crests, or kits. Club/league marks are separate licenses, many locked in competitor exclusives.
6. **Political revolt risk** — the Zlatan episode: stars publicly contesting the collective's authority over them. Contract for warranties + indemnities and keep a takedown pipeline.

---

## 4. Risk assessment (severity × likelihood)

Scale: Severity 1–5 (Negligible→Critical), Likelihood 1–5 (Remote→Almost Certain). Score = S×L. GREEN 1–4, YELLOW 5–9, ORANGE 10–15, RED 16–25.

| ID | Risk | S | L | Score | Level |
|---|---|---|---|---|---|
| R1 | Photorealistic/real-photo likenesses without license | 5 | 5 | **25** | 🔴 RED |
| R2 | Recognizable stylized avatars + real names, no license | 4 | 4 | **16** | 🔴 RED |
| R3 | Real names + stats only (no images), no license | 3 | 2 | **6** | 🟡 YELLOW (Brazil/Argentina: 3×4 = **12** 🟠) |
| R4 | Relying on FIFPRO assuming full coverage (legends, opt-outs, Brazil) | 4 | 3 | **12** | 🟠 ORANGE |
| R5 | Player names/nicknames in game title, store listing, or ads | 4 | 4 | **16** | 🔴 RED |
| R6 | Wrong-party licensing (paying an agent without authority) | 4 | 3 | **12** | 🟠 ORANGE |
| R7 | Real club names/crests/kits without club licenses | 4 | 4 | **16** | 🔴 RED |
| R8 | Real photos without photographer/agency license | 3 | 4 | **12** | 🟠 ORANGE |
| R9 | GDPR/personal-data processing of player attributes | 2 | 2 | **4** | 🟢 GREEN |

**Rationale notes:**
- R1/R2 likelihood is "almost certain/likely" not because every player sues, but because (a) detection is guaranteed — your game *markets itself* on the content, and (b) every litigated precedent went against the publisher (Hart/Keller/Davis, Brazil ×2, and even EA pulled Maradona for 3 years). Severity is critical for a startup: injunction + removal of core content = existential.
- R3 is the genuinely arguable zone. US 8th Circuit precedent (CBC) supports names+stats; Football Manager has used real names for 30 years (mostly uncontested — though they *license* much of what they use and still got sued by Man Utd over the club name). But it's a US circuit split, untested for a commercial avatar game in most of Europe/LatAm, and Brazil courts have treated name+image use as personality-right violations.
- R5 is red regardless of content licensing: it converts a content question into an **endorsement** question (passing off/trademark/false advertising), which is much easier for plaintiffs to win.

---

## 5. Mitigation options

| Option | Effectiveness | Cost/Effort | Recommended? |
|---|---|---|---|
| **A. FIFPRO group license before any likeness use** | High — covers ~65k players' name+image, industry standard | Medium (annual fee + approval process; start early — it's slow) | ✅ Yes — the core fix (Phase: soft launch at latest) |
| **B. Names+stats only at launch, stylized non-recognizable art** | Medium-High — moves you to the YELLOW zone | Low — design constraint | ✅ Yes — as the MVP/posture |
| **C. Fully fictional players** | Very High legally | Low cost, high product cost (weakens the fantasy hook) | ⚪ Fallback if license budget fails |
| **D. Individual deals for 1–3 headline stars (marketing)** | High for those players; useless for the rest | High per player (seven figures for a Messi-tier star) | ⚪ Only post-traction, with marketing budget |
| **E. Legends via estates** | High but slow | Medium-High, case-by-case | ⚪ Later content sets; never assume FIFPRO covers them |
| **F. Fictional clubs/leagues (transparent stand-ins)** | High — avoids R7 entirely | Low | ✅ Yes |
| **G. Contract hygiene: warranties, indemnity, coverage schedule, takedown SLA in the FIFPRO deal** | Medium — converts surprise into process | Low | ✅ Yes |
| **H. "Suspend player" pipeline + regional name-substitution in the data model** | Medium — caps blast radius (EA's Maradona mechanism; FM's "Man UFC") | Low-Medium engineering | ✅ Yes — build from day one |
| **I. Specialist sports/games IP counsel review + E&O insurance** | High as process | Medium | ✅ Mandatory before global launch |

---

## 6. Recommended approach for Tactics FC

1. **Prototype/validation phase (now):** fully fictional or names+stats-only; non-recognizable original art; no real player names in any ad, store listing, or the game title. This is legally survivable and costs nothing.
2. **Pre-soft-launch:** open the FIFPRO Commercial Enterprises conversation (slow — budget 6+ months); retain sports/games IP counsel; commission a trademark clearance search on your game title.
3. **Soft launch:** real player **names** via FIFPRO (if signed); fictional clubs; still no real photos — use licensed-or-original stylized player art. Implement the suspend/rename pipeline before any real player enters the build.
4. **Global launch:** likeness usage scaled to what the FIFPRO grant verifiably covers; Brazil/Argentina content reviewed by local counsel; legends only via estate deals; headline-star marketing only under individual contracts.
5. **Never-do list:** no real photos without dual clearance (player + photographer); no player names in title/keywords/ads; no trademarked nicknames or celebrations as game branding (CR7, "304", Mbappé's pose); no club crests/kits without club licenses; no legends from the FIFPRO pool assumption.

---

## 6.5 Appendix: How the three big publishers actually do it (verified playbooks)

### EA Sports (FC/FIFA) — "license everything"
- FIFPRO group license (extended Oct 2021) for 17,000+ players' names *and graphics*; layered with exclusive/semi-exclusive league, club, competition (UEFA), and stadium deals built over ~30 years — a licensing web analysts describe as EA's structural moat. Individual deals layered on top for legends and cover stars. This is the most expensive posture in the industry and not replicable on a startup budget.

### Konami (PES/eFootball) — "license the players, fake the clubs"
- Held FIFPRO since the ISS era → **real player names** throughout the series' history, while unlicensed clubs shipped under transparent fake names that became franchise folklore ("Man Blue" = Man City, "London FC" = Chelsea, "MD White" = Real Madrid, "PM Black White" = Juventus).
- A Konami mobile game's own license text shows the full stack in one place: FIFPRO Commercial Enterprises (player names/images) + league bodies (LFP, Eredivisie) + individual clubs (AC Milan) + UEFA + even adidas (kit/boot marks). Each is a separate contract.
- Exclusivity wars cut both ways: Juventus exclusive to Konami (2019) forced EA to use "Piemonte Calcio"; when Bayern's Konami deal lapsed (Jun 2025), eFootball replaced Bayern's name/crest/kits with generics and deleted the Allianz Arena — **but players kept their names and faces**, because those come from the separate FIFPRO grant.
- Cautionary note: the Brazil TJSP ruling (§2.4) was a **PES case** — Konami held FIFPRO and club contracts and still lost to an individual player claim.

### Sports Interactive/SEGA (Football Manager) — "names and stats, almost no faces"
- **FIFPRO agreement in place since at least FM 2005** (confirmed in SEGA's own Oct 2004 press release) plus league-by-league branding licenses (English Football League, Spain, US, Dutch, Portuguese, AC Milan at launch; full Premier League only from 2023).
- **The signature move: real players ship as silhouettes.** FM includes player pictures only "where available" under specific league licenses (FM 2005: ~6,450 pictures across a database of hundreds of thousands of people). Modern FM shows real players as black shadow icons; real-photo facepacks (Cut-Out, DF11's 250k faces) are *community mods* SI neither ships nor (visibly) enforces against — the mod ecosystem absorbs the licensing gap.
- SI actively **blocks** facepacks from applying real faces to fictional generated players, keeping the boundary clean.
- **Newgens** (fictional youth players) get procedurally generated 3D faces — visual richness with zero likeness exposure, because the people don't exist.
- Unlicensed clubs renamed: Juventus "Zebre" (FM20, Konami exclusivity), Manchester United "Manchester UFC"/"Man Red" (2021–2023 post-lawsuit) until the 2023 Premier League deal.
- **Lesson for Tactics FC:** FM proves a names+stats-first game with no real faces can be a 30-year commercial franchise — but note SI still *pays* for FIFPRO and league licenses; they are not free-riding on the CBC-style factual-data theory. Also note the mod safety valve doesn't exist on mobile app stores: anything shipped inside your app is your liability.

## 7. Key sources

- *Hart v. EA* (3d Cir. 2013), *Keller v. EA* (9th Cir. 2013), *Davis v. EA* (9th Cir. 2015) — via Crowell client alert; Hodgson Russ "Of Athletes and Video Games"; Albany Law Journal of Science & Technology
- *C.B.C. Distribution v. MLBAM* (8th Cir. 2007) — via K&L Gates memo; MSK alert; O'Melveny (incl. *Daniels v. FanDuel*, Ind. 2018); Tulane JTIP
- Zlatan/Bale dispute (Nov–Dec 2020) — SportsPro, nss-sports, easportslaw.com (incl. Premier League standard contract clause), Game World Observer (300+ players; Raiola)
- Brazil rulings — Murta Goyanes case note (TJSP 2018, PES); Brunel/Interactive Entertainment Law Review case comment; SportsPro (R$6.5M EA settlement, 2020)
- Maradona removal/return — VGC, Sports Illustrated, insideworldfootball, Radio Times (2022–2025)
- *Manchester United v. Sega/SI* — Sky News, talkSPORT, RPC Legal, WIPO "Mastering the Game" (2020–2023)
- *Fenty v Arcadia (Rihanna v Topshop)* — EIP, Simkins, JIPLP case notes (2013–2015)
- Player trademarks — CJEU *EUIPO v Messi* via Stanford/NJORD/Garrigues; Mundo Deportivo & beIN (Mbappé/Yamal/Messi/Ronaldo mark counts, Jun 2026); reggster.com
- FIFPRO structure & licenses — playtoearn.com/egamers.io (Soccerverse, Dec 2025); Naavik NIL digest; sportbusiness.com (EA–FIFPRO extension, Oct 2021)
- Tattoo/creative-content carve-outs — Foot Anstey, "Protection of image rights in video games" (Solid Oak v. Take-Two; Alexander v. Take-Two)
- Publisher playbooks — SEGA/SI FM 2005 licensing press release (FIFPRO agreement, picture counts); Goal.com "fake team names on PES"; Juventus–Konami exclusive announcement (2019); gamingonphone (Bayern license lapse, Jun 2025); breakingthelines (eFootball 2025 licenses); fullerfm & SI community forums (newgen faces, facepack policy); GALA Sports IPO materials (FIFPRO + club license stack on mobile)

**Disclaimer:** This document is research synthesis for product planning, prepared without access to any actual license agreements (all commercial terms are confidential). It is not legal advice. Retain qualified counsel in each launch jurisdiction before shipping real-player content.
