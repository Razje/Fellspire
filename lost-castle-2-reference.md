# Lost Castle 2: Game Reference

What the game is, how it plays, how it looks, and how every system works, as of v1.0.x (November 2026).

**Reliability:** ✅ store page / in-game notes · 🟡 several reviews or guides agree · ⚠️ one guide or wiki only. All move values (%) are damage multipliers on weapon ATK, taken from a community wiki. They're useful for proportions, but exact numbers change with patches.

---

## 1. The game in one paragraph

Lost Castle 2 is a 2D side-scrolling beat 'em up roguelite for 1–4 players. You play a rookie treasure hunter in a hunters' guild, fighting through monster-filled stages toward a dark castle in the border mountains. Mutated creatures, ghostly "Ethereals" and Soul Crystals have appeared there. Each run is a chain of locked combat rooms across several stages, each ending in a boss. You start with almost nothing, pick up weapons, armor, passive treasures, runes and alchemy items as you go, and build a character out of what drops. When you die the run ends. You go back to camp with the gold you earned, buy permanent upgrades, and try again. ✅/🟡

**Scale of content:** 200+ weapons and armors, 130+ treasures (the internal treasure library holds 300+ entries), 9 weapon categories, 10+ stages including hidden ones, 15+ bosses, 5 Nightmare difficulty depths, 85 achievements. ✅/🟡

---

## 2. Look & feel

### Visual style 🟡
- **2.5D side view:** characters move left/right and up/down in depth (a belt-scroller "lane" floor), drawn in 2D.
- Cartoon fantasy: **chibi proportions** (big heads, small bodies), **thick dark outlines**, bright, high-contrast colors.
- Each stage has its own palette and props: dark green forest, grey ruined village and graveyard, glowing crystal caves, sandy desert with shipwrecks, icy caverns, a stone bridge, and a gothic castle interior.
- Lots of hit effects: slashes, elemental bursts, lightning chains, poison clouds, screen-filling boss attacks with red/blue warning circles and laser lines marked on the floor before they hit.
- **Telegraphs:** red circles/lines = incoming attack area, blue/dark circles = zones to leave, a glow on a boss's weak point.
- Stylized **boss intro cards** and illustrated **loading screens** stand out.
- Light humor: silly enemies, a pettable dino at camp, emote wheel, unlockable hairstyles and costumes.

### Character presentation
- Custom character: appearance set at camp (stylist: hair and looks; costumes are cosmetic only).
- The equipped weapon changes your silhouette and animations completely.
- **Mounts** appear later in the game. 🟡

### HUD 🟡/⚠️
- Player HP bar, MP bar, and a **weapon-resource gauge directly under the HUD** (charge, combo points, heat, focus, phantom energy and so on, depending on weapon).
- Healing item counters (food, emergency bottle, elixir charges).
- Rune color counts, treasure icons, active effect icons.
- In co-op: each player's bars, soul markers for downed players.
- Map screen with branching routes; voting UI in co-op.

### Audio 🟡
- Fantasy soundtrack with one theme per stage; reviewers call it fitting but not memorable.
- Full voice audio exists in English and Chinese; very little spoken dialogue in practice.

### Controls ⚠️
Controller recommended; everything can be remapped.

| Action | Keyboard | Notes |
|---|---|---|
| Move | WASD / arrows | X + depth |
| Attack | J | basic chain; hold = charged version |
| Special | K | special chain; hold = charged/empowered version |
| Jump | Space | every character can jump; aerial moves |
| Dodge | L | free, no stamina; double-dodge = slide/dash |
| Interact | E | chests, NPCs, doors, shrines |
| Use item | I | healing / gear |
| Pause | Esc | team info, invites |

Input combinations are part of the move-sets: **Attack + Special**, **hold Attack + hold Special**, **Dodge → Attack**, **Dodge → Special**, **Jump → Attack/Special**.

---

## 3. Core loop

```
CAMP ─ choose allowed weapon pool, difficulty, co-op room, appearance
  │
  ▼
RUN ─ Stage 1 → Stage 2 → … → Final stage
  │     rooms → events → merchants → (optional cursed route) → stage boss
  │     loot: weapons, armor, treasures, runes, alchemy items, gold, materials
  ▼
DEATH or VICTORY ─ gold banked ─► permanent camp upgrades ─► next run
```

- Death ends the run; you restart at stage 1. Gold is kept and spent on permanent upgrades. 🟡
- **There's no class or level-up screen.** Your "class" is your weapon plus your amulet and gear. Builds take shape during the run. 🟡
- At the start of a run you normally pick 1 of 3 starting weapons; later you unlock a free choice of starter weapon at camp. 🟡
- At camp you choose **which weapon categories are allowed to drop**, which shapes your loot pool. 🟡

---

## 4. Run & map structure

- **Stages** are split into **rooms**. A room locks until all enemy waves are dead; enemies mostly come in from the sides. 🟡
- **Branching map** between rooms: you choose the next room or route. In co-op, **the party votes**. 🟡
- **Room types** 🟡/✅
  - Combat (normal waves)
  - Elite (stronger variants, better loot)
  - Challenge rooms with modifiers
  - Merchant / shop (buy with gold; sometimes a forge for upgrades)
  - Merchant settlement (guaranteed in later stages)
  - Treasure exchange area (swap treasures; later stages)
  - Event / NPC encounters (some NPCs then move to camp)
  - Healing spring / fountain
  - Side rooms with breakables (crates and barrels → gold, items)
  - Boss arena
- **Boss pool:** each stage picks one boss from its pool, so one run won't show all bosses. 🟡
- **Cursed routes:** an optional path that gives you a penalty (curse) and a strong reward. Beat that stage's boss, then **cleanse the curse** at the healing spring to keep the reward without the penalty. Cursed treasures exist too. 🟡
- **Auto-salvage:** gear you leave on the floor is automatically turned into materials when you leave the room. 🟡
- **Refills per stage:** food stack and emergency HP bottle refill at each new stage; the main elixir does not. 🟡
- **Hidden stages** are unlocked through persistent story clues gathered over several runs, or by clearing a stage on Nightmare. 🟡

---

## 5. Combat fundamentals

### 5.1 Defense
- **Dodge roll is free** (no stamina) with invulnerability frames. It's the main way to defend. Dodge twice to **slide/dash** forward (small damage on contact). 🟡/⚠️
- **Blocking** only exists on shield weapons and drains a stance gauge (see Single-Handed). 🟡
- **Perfect timing is rewarded:** perfect block (shield, 12-frame window → 450% counter), "instant return" (katana, 15-frame window → 550% counter). ⚠️
- Advice from guides: dodge telegraphed attacks instead of finishing combos; stay at a boss's side or back. 🟡

### 5.2 Healing 🟡
| Item | Behavior |
|---|---|
| Food (banana-type) | stack up to ~12, refills every stage |
| Emergency HP bottle | 1 big heal, refills every stage |
| Alchemy elixir | flask with limited charges (Estus-style), **doesn't refill per stage**; upgrades increase capacity; some weapons restore it on hit |
| Potions | drinking one gives a **random** small buff *or* debuff |
| Emergency Mechanism (upgrade) | one free revive per run |

### 5.3 Attack tags (drive synergies) ⚠️
Every hit carries tags that treasures, inscriptions and runes react to:
- **Direct vs. indirect** attack (indirect = DoTs, summons, procs)
- **Combo finisher** (last hit of a chain, or last bullet in a magazine)
- **Dodge attack** (attacks out of a dodge/slide)
- **Power attack**, **charged attack**, **skill**
- Weapon-specific: **magic bolt**, **elemental swing**, **heavy thrust jab**, summon attack and others

### 5.4 Elements & statuses ⚠️
- **Fire:** lingering flames / burn damage over time
- **Ice:** heavy hits, freeze-type control
- **Lightning:** chains that bounce between enemies (up to 6 bounces)
- **Poison:** acid pools and poison clouds over time
- Players get hit by status too: poison flooding, falling rocks, lightning zones, root traps.

### 5.5 Stats 🟡/⚠️
HP, MP, ATK (weapon base ATK × move %), DEF / damage reduction, crit rate and crit damage, attack speed, skill intensity (scales skill/summon damage), MP recovery, resource gain speeds (combo, focus, heat and so on), elemental damage.

---

## 6. Weapon categories & move-sets

Each category has its **own resource gauge** and its **own move-set**, built from the same input grammar: basic chain · special chain · hold variants · attack+special · dodge follow-ups · aerial/drop attacks. Individual weapons in a category share the move-set, but add **base ATK, rarity, element, tags, a unique weapon skill/effect and sometimes an inscription**.

| # | Category | Resource | Role |
|---|---|---|---|
| 1 | Single-Handed (shield) | Stance (block) gauge | Tank, parry |
| 2 | Dual Blades | Combo Points | Fast melee, mobility |
| 3 | Two-Handed | Charge gauge (3 tiers) | Slow, huge hits |
| 4 | Staff | Mana Energy → Energy Points + satellites | Elemental caster |
| 5 | Bow | Focus points | Ranged, piercing bursts |
| 6 | Turbo Lance | Pressure (heat) → Overload | Mid-range poke, burst mode |
| 7 | Musket / Firearms | Heat | Ranged, charged shots |
| 8 | Phantom Lantern | Phantom Energy → Overdrive | Whip + summoned phantom |
| 9 | Katana | Gathered-qi layers | Precision, counters |
| (+) | Devouring Beast | — | summon-style weapon ⚠️ |

### 6.1 Single-Handed (sword & shield) ⚠️
Subtypes: one-handed sword, one-handed axe/hammer, short spear.
- **Stance gauge:** base cap 200. Blocking drains it by the incoming attack's stagger value. Perfect blocks cost nothing. It regenerates after ~1 s without being hit. **At 0 you can't use special moves.**
- **Perfect block:** press special within **12 frames** of a frontal hit → parry + **450%** counter, then follow-ups.
- Shared moves: shield bash (special+attack) 100%, block-attack 100%, jump attack 90%, aerial shield drop 180% (can also perfect-block).
- **Sword:** quick chain 100→90→140→220%; heavy 1 and heavy 2 only reachable through chains (skill → heavy 1 → heavy 2); dodge slash 165%; parry follow-up cross slash 180+280%.
- **Axe/hammer:** chain 140→150→170% → aerial slam 420%; heavies 310% / 420%; parry follow-up 470% + 470%.
- **Short spear:** thrust 125% + upward 100%; multi-thrust heavies; lunge 168%.
- Shield attacks/skills hit harder while the stance gauge is full. 🟡

### 6.2 Dual Blades ⚠️
Subtypes: dual blades, dual daggers, dual axes/hammers.
- **Combo Points:** every direct qualifying hit adds 24 gauge; 100 gauge = 1 point. Heavy attacks don't add any.
- **Terminal special:** opening hit 40%, then **one extra slash per Combo Point spent** (57% base each, scaling with points). Uses all points.
- Fast two-handed hits (separate inner/outer hand values, e.g. 55% + 39%), whirlwinds, a 100% thrust finisher.
- Longest dash of all weapons; slide (dodge-dodge) 20%; dodge spin 44%/hand + 88% heavy.
- Aerial: 30% per hand; drop smash 100% + 60% shockwave.

### 6.3 Two-Handed ⚠️
Subtypes: greatsword/greataxe, heavy axe/hammer.
- **Charge gauge:** max 180 in 3 tiers (0–40 / 40–100 / 100–180). Fills while you hold charge inputs (and from some skills/treasures). Drains at 60/s after 1 s. Some moves need a minimum tier.
- Basic chain 200→215→290%; special chain 300→270→385%.
- Hold attack: whirlwind (110–200% by tier). Hold special: charged cleave **700% / 900%**.
- **Hold both at tier 3:** storm whirlwind 250% + aerial drop **1100%** (hammer: earthquake sweep → **1500%**), with 35% damage reduction while it runs.
- Dodge follow-ups 200% / 260%; aerial 180% / 300% plunge.
- Slow and committed; widely seen as the weakest category in crowded rooms. 🟡

### 6.4 Staff ⚠️
- **Mana Energy:** 100 energy = 1 Energy Point (base cap 2). "Magic bolt" hits give +3, "elemental swing" hits give +12; spending mana converts 50% of it to energy. Spending a point gives back 15 mana.
- **Satellites:** each Energy Point spawns an orbiting satellite that joins attacks (100% each).
- Basic chain: magic bolts 100% ×3, then a 3-bolt volley.
- Tap special = **elemental swing** (fire 100%, ice 100%, lightning 180%, poison 110% + acid pool).
- Hold special = **empowered swing** (1 Energy Point): fire 420% + 5 lingering flames; ice 285%; lightning 200% + 3 bouncing chains (195%, up to 6 bounces); poison 225% + falling poison orb → cloud.
- Jump: 2 bolts 70%; aerial slam varies by element.
- Low base ATK; depends heavily on inscriptions and mana treasures. 🟡

### 6.5 Bow ⚠️
- **Focus:** 100 = 1 focus point. Charged shots and power-tagged attacks build it much faster.
- Quick shots 80→65→2×100% (the last one while stepping back); charged shots 220%, 220%, 2×230%.
- **Hold special:** spread shot (3 × 85% close range); **at full focus it turns into a burst** of 3 piercing arrows at 300%.
- Aerial: 2 × 90%; drop attack 5 arrows × 90% or (full focus) 3 piercing × 360% downward.
- Dodge attack: 3 × 90%.

### 6.6 Turbo Lance ⚠️
- **Pressure gauge:** 0–100, never below 10. Light hits +3.6; skill use adds pressure. Decays if you miss for 3 s.
- **Overload:** at 70–100 pressure press special+attack (or hold both → forced Overload with a 220% elemental gas burst). In Overload the lance gets extra moves, then drains 2/s. At 0 it drops into a **cooldown/safe mode** with blunt hammer strikes (110–130%).
- Thrust chain ~90–95% pokes with upward jabs; heavy thrust with 4 extra hits and a **300%** finisher.
- **Pressure-release cannon** (special): 160% / 300% / 400% depending on pressure, **670%** in Overload.
- Hold attack: continuous charged thrust.
- Many lances fire **homing projectiles** (e.g. flames, light beams at the nearest enemy), which makes them strong from the back line in co-op. 🟡

### 6.7 Musket / Firearms ⚠️
Subtypes: hand cannon, long-barrel, magic beam gun, shotgun, rapid-fire.
- **Heat:** shown under the HUD. Every shot adds heat (rapid 10, cannon 20, long-barrel 14.3, shotgun 11.2). Specials need heat, and more heat = stronger.
- The **last round in the magazine** counts as a combo finisher. Shooting right out of a slide counts as a dodge attack.
- **Hand cannon:** 270% shells; "quick mortar" special 370% (25 heat).
- **Long-barrel:** 208% shots; hold special spends heat: 230% / 360% / **800%** at 90 heat.
- **Magic beam:** lasers 195%; hold special: up to level-3 ray **800%** that splits and **reflects** into weaker rays.
- **Shotgun:** pellets 124% plus a pellet hit-counter bonus; "suppressive fire" slide combo.
- **Rapid-fire:** 3-bullet bursts.
- Shared: jump-special drop 140%, backward hop shot on dodge+attack, slide 20%.
- Some musket inscriptions spend heat on grenades. 🟡

### 6.8 Phantom Lantern ⚠️
A **whip** for the player plus a summoned **phantom** that fights next to you.
- **Phantom Energy:** +7 per direct whip hit, cap 150. When full, press special twice → **Overdrive**: your and your phantom's attacks get stronger and use up the energy.
- **Phantom stats:** HP = owner's max HP; ATK and crit = owner's. Built-in protections: trap damage reduction, stacking damage reduction when hit (up to 3), +25% reduction below 35% HP.
- Whip moves: chain 80→60→30+140%; loop whip (hold) 45% pull + 57% retract; recall-whip spin + 140%.
- **Phantom types:**
  - **Vanguard:** melee fighter (axe/spear combos, 270% javelin throw, Overdrive slams up to 410%).
  - **Defender:** fists + guard: blocks and pushes away, 500% counter-punch, shockwaves up to 570%.
  - **Caster:** magic and explosive bolts, 6-bolt barrage, gravity bombardment (up to 8 bolts in Overdrive), bow stance heavy arrow 250%.
- Phantoms can be **thrown, dashed or used for possession** ("interactive state"); some lanterns have mech-riding attacks. 🟡

### 6.9 Katana ⚠️
- **Gathered qi:** +14 per hit; 100 = 1 layer, base cap 3 layers.
- Quick slashes 115% ×2, double sweep 50+115%, thrust 135%.
- **Heavy slash:** 100% at 0 layers, or spend 1 layer → 48% qi flash + **300%** finisher. Spinning / reverse spinning slashes can loop (250% with a layer).
- **Hold special = iai counter:** charge until a flash; release within **15 frames** of an enemy hit → **"instant return" 550%** (otherwise 150%).
- **Attack + special = leaping vertical slash:** launches you into the air, 200% airborne finisher.
- Dodge-dodge-attack: 100% dodge-thrust into the launcher.
- **Built for looping chains:** quick loop, spinning loop, and attack → special → launcher routes.

### 6.10 Individual weapon effects (examples) 🟡
- Restores alchemy elixir after attacks (cooking utensils, shield weapon)
- Finisher deals +18% damage (corrosive dual blades)
- Throws cleavers that can be thrown repeatedly; hits restore MP
- Shield damage +55%
- Fires flame projectiles at the closest enemy; light beam that empowers basic attacks
- Staff that casts meteor fragments, or seeking corrosive souls
- **Boss-unlocked weapons** (special chaos-themed katana, lantern and others)

---

## 7. Build systems

A build is made of **six layers**. Each one is simple on its own; together they create the variety.

### 7.1 Runes (3 colors) ✅/🟡
| Color | Name | Focus | Threshold payoff ⚠️ |
|---|---|---|---|
| 🔴 Red | **Akhil** | ATK, crit, direct damage, burst | "Rune Slash"-style extra strikes |
| 🟢 Green | **Parati** | HP, defense, survival | "Rune Quake": periodic defensive shockwave (charges on an interval; stronger at low HP with some items) |
| 🔵 Blue | **Nairu** | MP, skills, magic | "Rune Bullet": marks build up from weapon skill use and MP spending, then fire |

- Runes drop in chests and from dismantling gear. Holding enough of one color unlocks passives (one guide: 3 = first bonus, 5 = stronger ⚠️).
- **Gear can carry rune conditions:** a weapon or armor gets extra properties once you hold enough runes of its color.
- Guides advise committing to 1–2 colors per run.

### 7.2 Treasures (passive relics) ✅/🟡
- 130+ in the normal pool; colored and **tagged by genre** (crit, summon, projectile, skill and so on).
- **Synergy-aware drops:** new treasure drops are weighted toward what you already own.
- Triggers: on hit, on crit, on skill use, on summon attack, on boss kill, at low HP, on an interval.
- Effects: attack speed, multishot, projectile damage, HP, damage reduction, MP recovery, summon attack speed, scaling per boss killed and so on.
- **Cursed treasures:** strong upside, built-in downside.
- Treasure stands at camp/runs let you choose treasures; treasure exchange rooms let you swap them.

### 7.3 Armor 🟡
- Armor types (e.g. heavy, cloth) and named sets with their own effects and inscriptions.
- Armor proficiency is a permanent upgrade.

### 7.4 Inscriptions & resonance ✅/🟡
- **Inscriptions** are keyword families on weapons, armor and treasures (e.g. a summon-stepping one for lanterns, a sword-master one for katanas, a thunder-ranger one for bows, a dark-flame one for lanterns).
- **Resonance layers:**
  1. **First layer:** the item's own effect.
  2. **Second layer:** two pieces (e.g. weapon + armor) share a keyword family → bonus.
  3. **Third layer:** weapon + armor + treasure form one connected chain → strongest bonus (needed for top difficulties).
- Inscriptions are unlocked with **Soul Flowers**; **Champion Relics** grant a random one. ⚠️
- **Soul Stones:** permanent weapon buffs (ATK, speed and so on) once an inscription is unlocked. ⚠️

### 7.5 Alchemy Amulet 🟡
- Collect **alchemy materials** (mixtures, runestones, magical fragments, boss materials up to level 3) and **socket them into your amulet**. Each socket = one effect (e.g. +max HP, damage reduction, scaling with boss kills, damage after a kill).
- A camp cauldron/alchemist brews mixtures (up to 3 ingredients per brew ⚠️).
- Socket count grows with camp upgrades.

### 7.6 Hunter's Gear (active tools) ⚠️
A slot for active items with set roles: emergency recovery (HP bottle), extra damage (portable turret or cannon), room control (space-making, pressure relief), boss backup (burst or survival).

### 7.7 Weapon upgrading 🟡/⚠️
- **Forge/furnace:** upgrade weapon level with iron/ether ingots; costs rise per level.
- **Enchanting device** (from mid-game stages): adds enchantments (e.g. a tougher shield, extra satellites, a safety switch for the lance, a light tip that lets you move while charging) and can also upgrade.
- **Dismantling** gear returns ingots, purple shards and runes.

**How runs play out:** early stages = pick a category and colors; mid-game = lock in inscriptions and resonance; late = add soul stones and matching treasures. Skilled players stop treating every drop as a new choice once their direction is set. 🟡

---

## 8. Currencies & materials

| Resource | From | Used for | Kept after death? |
|---|---|---|---|
| Gold | enemies, breakables, rewards | camp upgrades, black market, shops | **Yes** 🟡 |
| Purple shards | dismantling | in-run shop | no 🟡 |
| Iron / ether ingots | dismantling | weapon upgrade, enchanting | no 🟡 |
| Reroll tokens | runs | reroll shop or curse choices | no 🟡 |
| Free shop ticket | shop | one free item | no 🟡 |
| Soul Crystals | runs | camp / soul-stone progression | ⚠️ |
| Soul Flowers, Champion Relics | runs | inscription unlocks | ⚠️ |
| Memory shards / story clues | runs | unlock hidden stages | yes ⚠️ |
| Alchemy materials | runs, bosses | amulet | ⚠️ |

---

## 9. Camp (hub) & meta-progression

The camp is the guild's base between runs. It grows as you meet NPCs during runs, who then settle there. 🟡

| Station / NPC role | Function |
|---|---|
| **Blacksmith** | choose which weapon categories can drop; starter weapon slots |
| **Upgrade table** | spend gold on permanent upgrades (talent tree) |
| **Alchemist's hut + cauldron** | amulet brewing and sockets |
| **Difficulty keeper** | Easy/Hard and Nightmare depth settings |
| **Log keeper** | records and stats of past runs |
| **Stylist** | hair and appearance |
| **Cosmetics merchant** | costumes / skins |
| **Black market** | one-off items for gold |
| **Campfire** | create or join co-op rooms |
| **Training ground** | practice with any weapon or treasure |
| Pettable camp dino | for fun |

**Upgrade tree (~3 branches, ~30+ nodes ⚠️):**
- *Combat:* ATK, HP, DEF, weapon privileges, armor proficiency
- *Alchemy:* amulet sockets, **Emergency Mechanism (free revive per run, most recommended first buy)**, bigger elixir
- *Fortune:* treasure stands, more rune drops, better dismantling returns, shop discounts

Core features (amulet, cauldron, hidden stages) are unlocked by **story progress**.

---

## 10. Difficulty & endgame ✅/🟡

- **Easy / Hard** setting. ⚠️
- **Ethereal Nightmare, depths 1–5:** turn on debuffs (less HP, smaller elixir and so on) for tougher runs and better rewards; in co-op the host sets the depth.
- **Nightmare-only content:** extra bosses, a Nightmare-gated dungeon route, stronger elite variants.
- **Advanced rule settings:** custom modifiers for challenge runs.
- **Chaos endgame:** clearing the top content unlocks chaos-themed weapons, armor, treasures and an alchemy material; the hidden boss has an extra final phase.
- **Achievements:** win with each weapon category, win on Hard, Nightmare depth 5, 4-player clears, specific treasure combos.
- Scales with player count in co-op.

---

## 11. Stages, enemies & bosses

### Stages (rough progression)
| Stage | Setting & enemies | Hazards / notes |
|---|---|---|
| Black Forest | goblins, undead, plant creatures | tutorial-level, poison plants |
| Abandoned Village & Cemetery | zombies, corrupted villagers, red-robed summoners, tree-throwers | ranged enemies, poison |
| Crystal Mountain | rock constructs, crystal creatures | falling rocks, crystal shards, lightning |
| Saltpeter Desert | 9 desert-specific enemy types, pirates/sea creatures | shipwreck setting |
| Frozen Cave (Ice Cellar) | ice monsters | wind-up attacks, cold |
| Black Castle Bridge | armored knights, nightmare armor, the Corrupted | branching sub-areas, high ground |
| Castle Dungeon | underground route (Nightmare-gated) | — |
| Black Castle | elite variants, highest enemy density, werewolf elites with grabs | leads to the finale |
| Hidden Mage Tower | secret stage via story clues | own bosses |
| Final chapter | story ending | multi-phase final fight |

### Bosses (attack patterns) 🟡
| Boss | Stage | Pattern / mechanic |
|---|---|---|
| Ghost of the Knight | opening | teaches the basic rhythm ⚠️ |
| Goblin Champion | Forest | ground thumps, leaping charges; after 3 charges he bangs his head → stunned |
| Mad Gardener | Forest | giant scissors; "dies", grows poison flowers and regenerates; phase 2 spits poison, then wilts → burst window |
| Forest Guardian | Forest | hammer swings, poison floods the arena; at 50% destroy bulbs on both sides of the tree; root traps |
| The Last Guardian | Village | charge → overhead/side/whirlwind sword; ultimate = two waves that pull you in |
| Mutated Priest | Village | summons zombies and throwers, throws rocks, hand slam; focus the left hand |
| Eugene & Bobby | Village | **duo:** potion-thrower (poison puddles) + charger; kill the thrower first, then the charger leaves rock and fire trails |
| Crystal Devourer | Mountain | fast blue dragon; stomps, dives, lightning circles; hit the tail; ultimate = layered circles + shards |
| Behemoth | Mountain | falling rocks and orbs; **throw orbs/stones at its glowing core**; vulnerable while resting |
| Thunder Sprite | Mountain | **shield-break** by throwing crystals; lightning circles/targets; phase 3 adds lightning rows |
| Treasure Anglerfish | Desert | — |
| The Captain | Desert | — |
| (2 frost bosses) | Frozen Cave | — |
| Wandering Knight | Bridge | mounted charges → dismounted greatsword phase |
| Nightmare Maid | Bridge (Nightmare) | — |
| Phantom of the Lost Swordsman | — | raises her fan before a big attack → dodge ⚠️ |
| Steward the Demon Sealer | Castle | fixed cycle: attack → rest → fly up → rest → ultimate; **ultimate can't be dodged** |
| Destroyer Demon Lord | Castle | follows Steward directly; hit landed electric limbs and the head; red laser lines, blue/dark zones |
| Mage Tower bosses, final boss | hidden / final | multi-phase |

**How bosses are built:** clear wind-up → attack → **rest/exhaustion window** → phase change at an HP threshold → ultimate. Patterns are learnable, not random. Variations: duos, environmental weak points, shield-break items, mounted→dismounted, fake death + regen, undodgeable ultimates you have to survive with HP.

---

## 12. Co-op ✅/🟡

- 1–4 players: **online**, **local couch** (shared screen), **LAN**, Remote Play Together; Quick Match into public rooms.
- Rooms are created at the camp campfire; friends are invited via the pause menu.
- **Route voting:** the party votes on the next room.
- **Revives:** a downed player leaves a **soul**; a teammate holds interact to revive. Releasing at the **sweet spot** restores more HP.
- **Item trading** between players; roles form naturally (shield tank in front, lance/staff/bow at the back, phantom summoner as support).
- Enemy HP/damage scales with player count.
- **AFK mode:** step away without blocking the party; rejoin with reduced buffs. ⚠️
- Emote wheel.

---

## Sources

Steam store page (app 2445690) and in-game update notes (via SteamDB); Game8, NoobFeed, Ladies Gamers, Escapist, OpenCritic reviews; Mobalytics beginner guide; GameBrief boss, weapon and builds guides; GamerSky weapon mechanics wiki (Chinese, 9 pages, used for all move values); dq7-reimagined builds and boss guides; lost-castle-2.pages.dev (unofficial fan wiki ⚠️); Pro Game Guides; allthings.how; Bleeding Cool, TwistedVoxel, Gematsu, Gamesunit (content announcements).
