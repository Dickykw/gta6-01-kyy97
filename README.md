# SOLMARA HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dickykw/gta6-01-kyy97/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dickykw/gta6-01-kyy97/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for [make.fun's **gta6-01 "Make GTA 6"** bounty](https://make.fun/bounty/gta6-01).
Play as **Dario Voss**, a freelance driver in the sun-soaked coastal district of
**Solmara Bay** — steal cars, run jobs for **Madame Luma**, outrun the Solmara PD,
and build your reputation one mission at a time.

Everything is original: the city, characters, vehicles, story, art and sounds.
Nothing from Rockstar Games or any other commercial game. The game runs fully
offline from static files — three.js is vendored under `game/vendor/`, all
textures are drawn at load time, all sounds are synthesized with WebAudio.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run |
| E | Enter / exit car (steal a parked car) |
| Mouse click / F | Shoot (on foot) |
| Space | Handbrake / drift |
| Drag mouse | Orbit camera |
| Mouse wheel | Zoom camera |
| Enter | Accept mission |
| M | Next mission |
| P | Pause |

## Features

- **Solmara Bay** — a dense 4×4-block coastal district: Torre Sol lighthouse,
  Plaza Mar clock tower, shops with original signage, park, beach and sea.
- **On foot + driving** — realistic-proportioned character, arcade handling with
  drift, skid dust and a smooth follow camera.
- **Traffic + pedestrians** — NPC cars on waypoint loops, pedestrians on the
  sidewalks with varied clothes, speed and behaviour; they flee from gunfire.
- **Wanted 0–3 + Solmara PD** — cruisers spawn out of view, chase and ram,
  cut you off at 3 stars; lose them and the heat cools down.
- **Missions + story** — 4 story jobs for Madame Luma (delivery, car theft,
  courier chase, police escape) with briefing, beacon marker, timer and reward,
  then repeatable free-roam deliveries.
- **Combat** — hitscan pistol with tracer, muzzle flash, impact particles and
  screen shake; targets react and wanted rises.
- **HUD + minimap** — mission panel, money, wanted stars, speed, context
  prompts, live circular minimap with mission/police/traffic blips.
- **Save** — progress (money, missions, position) persists in localStorage.
- **Sound** — synthesized engine, siren, gunshot, pickup and fanfare.

## Systems

| File | System |
| --- | --- |
| `game/src/world.js` | City, districts, landmarks, time of day |
| `game/src/player.js` | On-foot character, camera |
| `game/src/vehicle.js` | Cars, handling, headlights |
| `game/src/traffic.js` | NPC traffic + pedestrians |
| `game/src/police.js` | Wanted level, cruiser pursuit |
| `game/src/missions.js` | Story jobs, beacons, rewards |
| `game/src/combat.js` | Shooting, tracers, impacts |
| `game/src/hud.js` | HUD, minimap, district label |
| `game/src/audio.js` | Synthesized WebAudio sounds |
| `game/src/save.js` | localStorage progress |
| `game/src/shots.js` | Staged screenshots + self-test |
| `game/src/util.js` | Shared helpers |
| `game/src/main.js` | Game loop, renderer setup |

## Screenshots

Staged deterministically (`?shot=hero|drive|chase|complete&seed=7`) and rendered
from the game itself in headless Chrome. `?selftest=1` runs the scripted
playtest and logs `SELFTEST PASS/FAIL` to the console.

## License

MIT — see `LICENSE`.
