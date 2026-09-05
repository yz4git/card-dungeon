# CARD DUNGEON — B10 v2 implementation

Implemented the requested review priorities 1–5 while preserving the core fifteen-card / visible-five-turn planning combat rules.

## Completed scope

1. **Distinct B10 final boss**
   - Added `深淵王・終式` as the B10 boss instead of reusing the B5 Warden.
   - Uses a fixed fifteen-card script divided into three five-turn phases: `鏡界` / `断界` / `終焉`.
   - Card rank escalates by phase, and the battle UI shows the current phase.

2. **B6–B10 enemy variety**
   - Added `鏡骸の剣士`, `灰血の司祭`, and `断章の予言者`.
   - B6–B10 generation guarantees at least one late-game enemy pattern while still mixing earlier enemies.

3. **Clearer card acquisition and upgrades**
   - Reward cards can show `NEW`, personal-best rank improvement, and equipped-card rank comparison.
   - Added a reward action that claims cards and opens deck editing directly.

4. **Late-floor visual set**
   - B6–B10 now have distinct floor names and atmosphere/filter treatment.
   - B10 and the final boss receive a dedicated visual treatment and phase badge.

5. **Lower-friction deck management + recommendation**
   - Added a floor-aware `オススメ15枚` advisor.
   - The advisor maintains a balanced role mix and scores card rank plus utility such as pierce, cleanse, counter, sustain, and late-floor usefulness.
   - Reserve cards are sorted by recommendation score.
   - Recommended cards and newly acquired cards are marked.
   - Selecting an equipped slot shows high-value swap candidates.
   - `オススメ編成を適用` performs the recommended fifteen-card rebuild using the existing deck editor operations.

## Balance / regression validation

Validated on the current gameplay engine in GitHub Actions:

- Unit tests: **18 / 18 passed**.
- Static validation: **34 files**, local imports and syntax passed.
- Skilled planning + deck editing, first life: **15 / 20 = 75% B10 clear**.
- Skilled planning + deck editing, up to five deaths: **12 / 12 = 100% B10 clear**, average deaths **0.8**.
- Detailed seed `20260905`: final boss cleared in **9 turns**; combat HP `79 → 40`, then `59` after victory recovery.
- Starter deck never edited: **0 / 12** progressed beyond the B5 tier, so deck upgrading remains strategically meaningful rather than cosmetic.

The first draft of the new late-game enemies/final boss was intentionally retuned after simulation showed a 5% first-life B10 clear rate. The current 75% result is close to the pre-pass 70% baseline while adding a longer, distinct B10 climax.

## Verification note

The implementation has been exercised through unit tests, static-build validation, and automated B1–B10 gameplay simulation. This validation does not claim a manual iPhone Safari tap-through or visual screenshot playthrough.
