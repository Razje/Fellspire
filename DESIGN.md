# Fellspire: design

Martijn owns this document. It says what the game is and in what order it gets
built; each work session takes the next open item. Change it whenever the plan
changes. Status markers: **done**, **next**, or nothing (not started).

## Pitch

A side-scrolling fantasy brawler roguelite for one or two players. Pick a hero,
fight through three zones of randomly ordered rooms, loot weapons that change how
you fight, and die often. Every death still makes the next run stronger. The
journey ends at the Fellspire, a frozen tower where the run's final boss waits.

Inspirations: Lost Castle 2 for the structure and look, classic fantasy MMOs for the
feel. Original world, original names (see the hard rules in `CLAUDE.md`).

## The run loop

1. **Hub camp.** Choose a class, spend embers carried back from earlier runs, step
   through the portal.
2. **Zone.** 6 to 8 rooms in random order, then a boss.
   - Combat room: clear the waves to open the exit.
   - Elite room: one tough enemy, better loot.
   - Treasure room: a chest, sometimes trapped.
   - Merchant: weapons, potions and trinkets for gold.
   - Shrine: one of three class upgrades, or a curse for a strong reward.
3. **Three zones per run**, each harder. Gold and gear are lost on death; embers are kept.

## Combat

Side-on, with depth to walk in (a belt scroller).

- Light attack (three-hit combo), heavy attack, dodge roll with invulnerability, block.
- Two class skills on cooldowns and an ultimate that charges from dealing and taking damage.
- The weapon decides the moveset; each class uses two weapon types.
- Enemies telegraph big attacks with a wind-up and a red ground marker. Hitting
  them during the wind-up interrupts it.

## Classes

| Class | Role | Weapons | Skills | Ultimate |
|---|---|---|---|---|
| Ironguard | Tank | Sword and shield, axe | Shield bash (stun); taunt shout | Bulwark: dome that blocks projectiles |
| Dawnpriest | Healer and fighter | Mace, holy tome | Smite (heals allies nearby); consecrated ground | Radiance: big heal plus stun |
| Ashblade | Melee damage | Daggers, curved sword | Shadowstep; poison flurry | Thousand cuts |
| Frostweaver | Ranged caster | Staff, wand | Frost bolt (slows); blink | Blizzard: large freezing area |

Later: Hexbinder (damage over time, summoned imp), Wildcaller (bear and ranged forms).
The Valkyrie pack currently stands in for the hero.

## Loot and upgrades

- Rarity colours: grey, white, green, blue, purple, orange.
- Trinkets are passives ("dodging leaves a frost patch"); combinations make runs differ.
- Shrines offer picks from a small tree per class: three branches of five.

## Zones

**1. Blightwood.** A rotting forest village overrun by the dead; the tutorial zone.

| Enemy | Teaches | Art |
|---|---|---|
| Ghoul | Basics: charges in a line | Zombie Villager (in) |
| Bone thrower | Close the distance or dodge | Skeleton Warrior (in) |
| Plague bloater | Spacing: explodes, leaves poison | to choose |
| Cult acolyte | Priority: shields others | Necromancer of the Shadow (free) |
| Grave knight (elite) | Blocking and parry timing | to choose |

Boss, **the Lantern Warden**: lantern slams and summoned ghouls; at half health the
lantern breaks and the fight continues in a shrinking circle of light.

**2. Scorchreach.** A raider war camp in red badlands: brutes, wolf riders, fire shamans.

**3. The Fellspire.** A frozen tower. Final boss: a lich who steals one of your skills.

## Look

Lost Castle 2's palette: dark teal night, warm pools of fire and lantern light, glowing
cyan and violet magic, black foliage silhouettes framing the screen. Characters are
CraftPix's vector chibi range (one studio, so they match); backgrounds painted.

The interface takes its **layout from Lost Castle 2** (small, at the screen edges, the
hero's things bottom left, announcements on a dark band across the screen) and its
**styling from classic fantasy MMOs**: a portrait in a gilded ring, green health with
white outlined numbers, square action slots with the key in the corner and a cooldown
sweep, dark panels with a silver bevel for small things and a gilded bevel with corner
gems for menus, red buttons with gold trim and gold lettering, an objective tracker,
floating combat text (white hits, big gold heavy hits, red damage taken, green heals),
zone text when entering a place. Fonts: Cinzel Decorative for the logo, Cinzel for
headings and numbers, Marcellus for labels and body text. Item quality colours are set
aside for loot (white, green, blue, purple, orange). Azeroth Survivors' interface was
studied for its card and end-screen ideas only; none of its art is used.

## Build order

1. **done** Movement and combat for one hero against training enemies.
2. **done** Ghouls and bone throwers in a room, with waves.
3. **done** Rooms in a row, the exit, health orbs. (Weapon drops still to come.)
4. **done** Title screen with menu, options and credits (2026-11-23).
5. **done** The fight scene in the title screen's look: painted Blightwood
   layers, torches whose light warms the characters, the rune ring as the exit,
   foreground framing, a gold unit-frame HUD (2026-11-23).
   **done** Depth rework after Martijn found it "too 2D side-scrolling" next to
   Lost Castle 2: rooms are now arenas seen from above at an angle (floor about
   half the screen and more, a tree line behind), characters about half the
   size, props throughout the floor with footprints, the camera following both
   ways, equal speed in every direction, attacks aimed up or down, a dodge in any
   direction, ghouls that spread out around you, enemies stepping out of the trees.
   **done** Interface overhaul (2026-11-24): full-HD rendering, one UI kit for every
   screen, the HUD above, a pause menu on Esc, an end-of-run screen with the run's
   numbers counting up, title menus and Options rebuilt with check boxes and sliders.
6. **next** The Lantern Warden boss fight.
7. Gold and the first weapon drops.
8. A second class, and two-player co-op on one screen.
9. Hub camp with embers between runs.

After 6, zone 1 is a complete, playable slice.

## Notes from the Lost Castle 2 reference

What gives it depth, from frames of a gameplay video (2026-11-23): the camera looks
down at the ground rather than across it; the walkable floor fills half the screen
or more (at camp nearly all of it); characters are about a tenth of the screen
high; barrels, torches, crates and logs stand throughout the floor, not only along
the back; paths curve away into the depth; movement is equally free in every
direction.

`lost-castle-2-reference.md` (Martijn's research, 2026-11-23) describes the game in
detail. Points to carry into Fellspire as the matching steps come up:

- Telegraph colours: red circle or line = an attack is coming there; blue or dark
  zone = get out. Bosses follow wind-up, attack, rest window, phase change, ultimate.
- Rooms lock until every wave is dead; enemies come in from the sides (as now).
- Side rooms with breakable crates and barrels that drop gold and items.
- A healing spring room, and cursed routes that are cleansed there.
- HUD: HP, plus a gauge under it for the weapon's own resource.
- Their controls: J attack, K special, **Space jump**, **L dodge**, E interact.
  Ours: Space dodge, L block, no jump yet. Worth deciding before co-op.

## Open questions

- Controls: keep Space as dodge, or follow Lost Castle 2 (Space jump, L dodge)?

- Which free or paid pack becomes the Ironguard? (Paladin or Armored Knight, $5.50 each.)
- Sound and music: not started; needs a source with a licence that fits.
