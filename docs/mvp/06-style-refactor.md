# 06 — Style Refactor: De-AI the Look, TFT-ify the Flow

**Status:** Design decision record (v1), founder-requested 2026-07-31
**Goal:** simple-first — on any screen, a new player instantly knows what to do. Model the planning experience on TFT. Purge "AI-slop" visual tells.

## Research synthesis

### What makes designs "look AI" (sources: 925studios AI-slop tells, avoid-ai-design catalog, Anthropic frontend-design guidance)

The AI fingerprint is *unchosen defaults*: Inter-with-no-type-decision, indigo→purple gradients, three rounded cards in a row, `rounded-2xl shadow-lg` on every surface, glassmorphism by reflex, emoji as feature icons, uniform `gap-4` spacing, generic CTA copy, timid evenly-spread palettes. The fix is **constraint**: dominant color + sharp accent, deliberate type hierarchy, real spatial rhythm, one or two purposeful motion moments.

**Audit of our app:** no purple gradients (good), emerald is a real dominant-color decision (keep). Actual tells present: emoji in structural chrome (💰🔄 buttons), uniform `rounded-xl` everywhere, flat section hierarchy, spacing rhythm is uniform, headers are generic weight/size. Verdict: P1-level — fixable with a surgical pass, not a rebuild.

### TFT planning-phase patterns (the "always know what to do" gold standard)

1. **One persistent planning screen.** Shop is a bottom bar, bench above it, board center, HUD (HP/gold/streak) top, traits rail on the side. Players never navigate between "shop screen" and "board screen" — our Transfer Window → Tactics split is the biggest intuition gap we have.
2. **One primary CTA, always visible, verb-labeled.**
3. **The board is the anchor** — your squad is visible on the pitch while you shop, so cause (buy) and effect (lineup) share a view.
4. **Simple-view information** — TFT mobile players' #1 complaint is "reading paragraphs"; chips and badges beat sentences.

## The refactor

### A. Merge Transfer Window + Tactics into one Planning screen (TFT layout)

```
┌─────────────────────────────────────┐
│ HUD: Round · ❤HP · 💰 · streak · opp│  persistent top bar
├─────────────────────────────────────┤
│ Combo chips (current → next tier)   │
│ ┌─────────────────────────────────┐ │
│ │        PITCH BOARD              │ │  FWD/MID/DEF/GK zones,
│ │   (chips on a real pitch)       │ │  tap player → tap zone
│ └─────────────────────────────────┘ │
│ Bench row (owned, unfielded)        │
│ Shop row (5 cards + reroll)         │  bottom bar, TFT-style
│ [ ⚽ KICK OFF vs {opponent} ]       │  single primary CTA
└─────────────────────────────────────┘
```

Buying, selling, rerolling, and placing all work in one place; both `TRANSFER_WINDOW` and `TACTICS` phases render this screen. The product spec already allowed this (§Screens: "may be one combined screen").

### B. Persistent HUD

Top bar on every in-game screen: round, HP, credits, win streak, next opponent. Scores and numbers use tabular figures.

### C. Visual de-AI pass

- **Type:** section labels become `uppercase tracking-widest text-[11px]` micro-labels; big numbers/tabular-nums; headers use black weight with tight tracking (system stack — no network fonts allowed by constitution #6, so identity comes from weight/case/tracking, not a new font).
- **Surfaces:** `rounded-md` panels replace uniform `rounded-xl`; one accent border treatment; remove reflexive gradients except the pitch texture.
- **Pitch texture:** mowing stripes via `repeating-linear-gradient` — real-world reference, not abstract gradient.
- **Emoji:** removed from structural chrome (buttons/labels); kept inside narration text where they carry emotion (⚽🟨⚡).
- **Motion:** kept purposeful — goal flash, ball glide. No new decoration.

### D. What deliberately does NOT change

Sim, contracts, phases, persistence, tests. Color semantics from the 2026-07-31 UX pass (nationality tints, feed coding) stay — they already follow redundant-encoding rules.
