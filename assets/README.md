# Where the art goes

Nothing here is committed except this file: the packs' licences forbid passing
their source files on. The game picks up whatever is in these folders when the
dev server starts. Restart it if new art does not show up.

## Characters

Unzip a whole CraftPix pack into the folder for the role it plays:

| Folder | Role in the game | Free pack to try first |
|---|---|---|
| `characters/hero/` | the player | Valkyrie, or Skeleton Crusader |
| `characters/ghoul/` | melee enemy | Zombie Villager |
| `characters/archer/` | the enemy that throws bones | Skeleton Warrior |

The folder layout inside does not matter. The game finds the folders of PNG
frames by their names (`Idle`, `Walking`, `Slashing`, `Throwing`, `Hurt`,
`Dying` and so on). When a pack holds several colour variants it uses the first;
change `variant` in `src/config.ts` to pick another.

A character needs at least an `Idle` folder to be used. Without one, the drawn
stand-in stays.

## Background

Put the layer PNGs of one parallax background straight into
`backgrounds/active/`, no subfolders. They are drawn back to front in file name
order (`1.png`, `2.png`, ...), and the last one moves with the ground.

If the ground in the picture does not line up with where the characters walk,
change `groundTop` and `groundBottom` in `src/config.ts`.
