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

1. **Hub camp.** Make your character once (customisation), then before each run
   choose a starting weapon, spend embers carried back from earlier runs, and step
   through the portal.
2. **Zone.** 6 to 8 rooms in random order, then a boss.
   - Combat room: clear the waves to open the exit.
   - Elite room: one tough enemy, better loot.
   - Treasure room: a chest, sometimes trapped.
   - Merchant: weapons, potions and trinkets for gold.
   - Shrine: one of three weapon upgrades, or a curse for a strong reward.
3. **Three zones per run**, each harder. Gold and gear are lost on death; embers are kept.

## Combat

Side-on, with depth to walk in (a belt scroller).

- Light attack (a combo), heavy attack, dodge roll with invulnerability; block on shield weapons.
- **The weapon decides how you play**, as in Lost Castle 2: its moveset, its skills and
  its resource. Picking up a different weapon in a run changes your playstyle.
- Enemies telegraph big attacks with a wind-up and a red ground marker. Hitting
  them during the wind-up interrupts it.

## No classes: the weapon is the playstyle

Decided by Martijn on 2026-11-24, replacing the four classes planned earlier
(Ironguard, Dawnpriest, Ashblade, Frostweaver). You make **one character** with
customisation, and **the weapon decides how you play**, as in Lost Castle 2. A starting
weapon is chosen in the hub before each run; others come from chests during the run.

The weapon types (Martijn's list, 2026-11-24), each with its own moves, skills and
resource, as in Lost Castle 2:

| Weapon | Plays as | Art and animation needed |
|---|---|---|
| Single-handed + shield | Balanced; block, shield bash | Valkyrie's sword and shield fit as they are |
| Two-handed | Slow, heavy, long reach; charged blows, spin | A greatsword part; heavier swings (adapt Slashing) |
| Dual blades | Fast combos, mobility, finishers | A blade in each hand: an off-hand attachment; quicker swings |
| Staff | Ranged magic, elemental bolts, a charged blast | Staff part; a casting animation |
| Wand | Quick one-handed casting, rapid bolts | Wand part; a short cast (adapt Throwing) |
| Bow | Ranged; charged and spread shots | Bow part; draw-and-shoot animation; arrows |
| Blunderbuss | Short-range spread shot, knockback, slow reload | Gun part; firing animation with recoil; muzzle flash, pellets |
| Dual revolvers | Fast ranged fire, reloads, dodge-shooting | A revolver in each hand; firing animations; bullets |

**Every weapon has a unique skill** on its own key with a cooldown, a big signature
move (Martijn, 2026-11-24): a staff that calls down a blizzard over an area, a
greatsword that leaps into the air and slams down with a huge slash. A first draft,
two or three per type so that individual weapons from chests can carry different
ones (names are our own, nothing borrowed):

| Weapon | Skills (draft) |
|---|---|
| Single-handed + shield | Shield Charge (rush forward, stun what you hit); Bulwark (raise the shield, reflect projectiles) |
| Two-handed | Leap Slam (jump up, crash down in a ring of force); Cyclone (spin while moving); Earthsplitter (a crack tearing along the floor) |
| Dual blades | Shadowstep (vanish, strike from behind); Blade Storm (a flurry of quick cuts); Knife Volley (blades thrown all around) |
| Staff | Blizzard (ice falling over an area, slowing and hurting); Meteor (a marked circle, then a burning impact); Chain Lightning |
| Wand | Spark Volley (seeking bolts); Frost Ring (a ring of ice that freezes those nearby); Blink (teleport a short way) |
| Bow | Rain of Arrows (an area peppered from above); Piercing Shot (one arrow through a whole line); Spread Volley |
| Blunderbuss | Cannon Blast (a huge cone, knocking you back too); Explosive Shell (a lobbed shot that bursts) |
| Dual revolvers | Fan the Hammer (six fast shots); Ricochet (bullets bouncing between foes); Roll and Fire (a dodge that shoots) |

**Per weapon** (decided by Martijn, 2026-11-24): each weapon found carries one skill
from its type's list, so two staffs can differ (one calls a Blizzard, another a
Meteor), as in Lost Castle 2. The skill shows on the chest's card and in the tooltip,
and is part of what makes a pick interesting.

The rig already swaps a part for a drawn weapon by its grip (rig lab). Still needed
for this list: an off-hand weapon (dual blades, dual revolvers), and new animations
for shooting, casting and firing, written as keyframes in the same format.

Since 8.4 the hero holds the weapon she carries: the pack's sword and shield, or a
drawn greatsword, bow or staff on the sword's grip (`armRig` in `src/rig/weapons.ts`),
held upright while the pack's animation would hide its sword. Real weapon types need character art where the
weapon is separate from the body (see Open questions). The Valkyrie pack stands in
for the player character until then.

## Loot and upgrades

- Rarity colours: grey, white, green, blue, purple, orange.
- **No loot on the floor** (Martijn, 2026-11-24). A big chest waits from the start
  in a stone shrine at the top middle of each combat room, sealed and dark; when the
  room is cleared a shaft of light falls on it and its runes wake (as in Lost Castle
  2). E opens it and the room pauses for "Choose a weapon / an armor
  kit / a trinket": three cards of one category, each of a random rarity, after Lost
  Castle 2's treasure choice. Later rooms lean towards better rarities.
- Weapons and armor replace what you carry; trinkets are all kept. (Before 8.4 a
  weapon could not change what the hero held, so there were three sword kinds:
  Longsword (balanced, three strikes), Greatblade (slow,
  reach, a spinning heavy), Rapier (fast, four strikes, a lunging heavy).
- Effects: heal on hit or kill, burning ground from heavies, frost slows, chain
  lightning every fifth hit, damage against the nearly dead, double-damage strikes,
  thorns, second wind, faster dodge, stronger health orbs, more health.
- Gold drops from enemies and from smashed barrels and crates (Lost Castle 2 does
  the same). Nothing spends it yet; that comes with the merchant.
- Trinkets are passives ("dodging leaves a frost patch"); combinations make runs differ.
- Shrines offer picks from a small upgrade tree per weapon type.

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
6. **done** The Lantern Warden (2026-11-24). Martijn played it: quite hard, and
   meant to be, so the numbers stay as they are. For now a zone is three
   combat rooms, then his glade as room 4. An introduction pans to him and shows
   his name card; a boss bar at the top marks half health. Phase 1: lantern slam
   (a red circle where you stand), a sweep in front, ghouls summoned from the trees.
   After every three attacks he rests and takes half again as much damage (EXPOSED
   on the bar). At half health the lantern shatters, the torches go out, and the
   fight continues in a shrinking circle of light around its flame in the middle;
   the dark costs health. He is faster then and adds the ember rush, a charge along
   a red line. Beating him gives a gold victory screen. Art is a stand-in (the
   skeleton pack at twice the size, darkened, with a painted lantern) until a pack
   is chosen. Numbers to tune are `WARDEN` in `src/entities/Warden.ts` and `DARK`
   in `src/config.ts`.
7. **built** Gold and loot (2026-11-24): coins from enemies and breakable barrels
   and crates, the room chest in its shrine with three cards (weapons, armor kits or trinkets),
   gear and trinkets on the HUD with hover tooltips, gold on the end screen.
   Everything an item can be is in `src/loot.ts`.
8. **in progress** Character creation and weapon choice in the hub, in parts:
   8.1 **done** the hero drawn from her parts in the fight (and the HUD portrait);
   8.2 **built** character creation (2026-11-24): name, helmet, eyes, armour set and
   skin tone (seven tones, recoloured from the art), Randomise; the first New Run opens
   it, the title menu's Character item reopens it, the hero is remembered in the
   browser and shown at the title campfire, in the fight, on the HUD and the end screen;
   8.3 **done** the hub (2026-11-24): New Run, Try Again and Restart Run all lead to a
   camp in the Blightwood with a campfire, a weapon rack (E offers the three weapons that
   exist today as cards; the pick is remembered for the next run), a training dummy that
   takes every blow, never falls and shows damage per second, and the rune gate, lit from
   the start, into room 1. `?camp` on the address goes straight there;
   8.4 **built** the weapon framework, skill key and the first four weapons
   (2026-11-24): sword and shield (the only one that blocks; Shield Charge),
   greatsword (slow, long reach, a spinning heavy; Leap Slam), bow (arrows, a long
   draw that pierces a line; Rain of Arrows), staff (bolts, an orb that bursts;
   Blizzard). The skill is on **I** (LB on a controller) with a cooldown, shown in a
   fifth action slot; cards and tooltips name a weapon's skill. Each type is one
   entry in `src/weapons.ts`, the skills play out in `src/skills.ts`, arrows and
   bolts fly in `src/shots.ts`. The Rapier is gone (dual blades take its place in
   8.5); a remembered Longsword or Rapier becomes sword and shield, a Greatblade the
   greatsword. One skill per type so far; the list per type is ready for more.
   Bow and staff borrow the pack's Throwing animation, so the bow is held at the
   hip while shooting: a draw-and-shoot and a cast animation are still to make.
   8.5 dual blades and wand; 8.6 blunderbuss and dual revolvers.
   Overall: make a character with
   customisation, pick a starting weapon type, each type with its own moves.
   Depends on the art question below.
9. Two-player co-op on one screen.
10. Hub camp with embers between runs.

After 6, zone 1 is a complete, playable slice. Playtest the boss straight away
with `?boss` on the address (http://127.0.0.1:5180/?boss).

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

- Which pack becomes the Lantern Warden? A reaper or wraith type would suit.
- **Character art for customisation and weapon types.** The CraftPix chibi packs draw
  the weapon into every frame and offer only a few colour variants, so they cannot
  give a bow, a staff or a new hairstyle on the same character. Needed: modular art
  (separate body, hair, armour and weapon layers) in a matching style, or our own
  weapon sprites attached to a hand point.
  **Researched 2026-11-24:** the CraftPix packs already downloaded include each
  character's separate parts (`PNG/Vector Parts`: body, head, three faces, arms,
  hands, legs, sword, shield) and a Spriter animation file (`Animations.scml`, 18
  animations). Valkyrie, Skeleton Warrior and Zombie Villager share one rig: the same
  parts at the same sizes, the same bones (the Valkyrie adds one for her shield), the
  same animations. So parts from any CraftPix chibi pack fit any other. Plan: play
  the `.scml` files ourselves in Phaser (an open XML format, no runtime licence), then
  build characters from mixed parts and swap the weapon part. Bows and staffs need
  either a CraftPix archer or mage chibi pack (about $5.50 each; check the rig matches)
  or weapon parts drawn here, plus new animations for shooting and casting.
  Alternatives looked at: Hippo's Fantasy Heroes editor (a different style, and every
  combination pre-exported as a sprite sheet), Spine-based packs (Spine licence needed
  for its runtime), free CC0 modular vector characters (style does not match).
  **Proof of concept, 2026-11-24 (the rig lab, `?rig`):** our own Spriter player
  draws the Valkyrie from her parts indistinguishably from the ready-made frames
  (overlaid, they line up stroke for stroke) and sharper. A Skeleton head on a
  Valkyrie body and a Valkyrie head on a Zombie body both work. Drawn weapons follow
  the hand, but the packs' animations are made for a sword (Throwing even hides it),
  so a bow and a staff need animations of their own (draw and shoot, cast), and a
  big head can hide a weapon held behind it.
- Sound and music: not started; needs a source with a licence that fits.
