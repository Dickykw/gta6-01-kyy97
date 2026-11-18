# SOLMARA HEAT — Technical Design

Open-world crime game built for the make.fun gta6-01 bounty ("Make GTA 6").
Three.js, plain static files, no build step, no network requests, no external
assets: every texture is drawn on canvas at load time and every model is built
from primitives. Deterministic seed 7.

## The game

Dario Voss, freelance driver in Solmara Bay — a 4x4-block coastal district with
a marina, a market, a downtown, a park and the Plaza Mar clock tower under the
Torre Sol lighthouse. Madame Luma hands out courier jobs: pick up, deliver,
steal the requested car, lose the police. Free roam between jobs. Wanted level
0–3 stars, Solmara PD cruisers + a helicopter, ramming and escapes, a pistol
with ammo, health/armour, REP ranks, and a save in localStorage.

## Systems

| System | File | What it does |
| --- | --- | --- |
| World | `game/src/world.js` | 4x4 district, 16 named districts, sea + beach + pier + 3 sailboats, Torre Sol lighthouse (striped, rotating beam), Plaza Mar clock tower, 13 building types with tiered setbacks / pitched roofs / rooftop gardens / spires / balconies / storefronts / neon blade signs, market stalls, park + fountain, street lamps, palms, billboards, distant skyline, perimeter wall. 4 time-of-day presets (golden / day / dusk / night) driving sky, fog, sun, lamps, signs and wet-road roughness. `districtAt(x, z)` names the district the HUD shows. |
| Player | `game/src/player.js` | Dario on foot (1.8 m low-poly humanoid, walk/run swing, idle breathing), third-person orbit camera with drag + wheel zoom, enter/exit vehicles, hero fill light. |
| Vehicles | `game/src/vehicle.js` | 8 types (Kestrel S, SolCab, Hauler Bison, Vantara GT, Solmara PD, SolVan, SolBus, SolPickup): extruded side-profile body shells with bevels, greenhouses, spoilers, wheel-arch fenders, hubcaps, headlight/taillight glow sprites, contact-shadow blob. Arcade driving: acceleration, steering, handbrake drift, skid dust, collision, car-car push, autopilot (`chaseInput`). |
| Traffic | `game/src/traffic.js` | 14 NPC cars on closed road loops (right-hand lanes, stop for the car ahead), 39 pedestrians (varied clothes/build, sidewalk loops, pairs, idle, flee from gunshots, knockdown), 3 market vendors. |
| Police | `game/src/police.js` | Wanted 0–3, cruiser spawns with pursuit AI, ramming, light-bar flash + glow halo, helicopter with spotlight at 3 stars, wanted decay when the heat is lost. |
| Missions | `game/src/missions.js` | 5 scripted jobs (delivery, steal, chase, escape, taxi) + free-roam courier loop: briefing → accept → pickup → return → complete, timer, beacon, reward, REP. |
| Combat | `game/src/combat.js` | Pistol raycast shooting, crosshair, camera shake, muzzle flash, ped/car hits feed the wanted level. |
| HUD | `game/src/hud.js` | District + sub-district (live from `districtAt`), mission panel with stage bar + next objective + timer, money, wanted stars, REP bar, weapon slots, health/armour, speed + vehicle condition, context prompt, live minimap (player arrow, mission blip, police, traffic, lighthouse, plaza), police panel with per-unit distance/status, toasts, dialog strip with canvas portraits, start / briefing / complete / failed / busted / pause screens. |
| Audio | `game/src/audio.js` | WebAudio synth: engine hum, sirens, mission stingers, Solmara FM music loop. No audio files. |
| Save | `game/src/save.js` | localStorage save (money, mission index, completed, player position). |
| Shots | `game/src/shots.js` | Deterministic screenshot staging (?shot=hero\|drive\|chase\|complete, seed 7) and the scripted self-test (?selftest=1, 14 checks). Every shot plays the real systems forward from a staged state. |
| Bootstrap | `game/src/main.js` | Renderer (ACES filmic tone mapping, sRGB output, PCF soft shadows, antialias), game loop, input, shot-mode autopilot, headlight spotlight, damage/ramming, escapes, health regen. |

## The 4 staged shots (seed 7)

| # | Shot | Staging |
| --- | --- | --- |
| 1 | `hero` | Golden hour, MARINA. Camera 20 m north of Dario on the Dario–lighthouse line, low pitch: Dario ~60 px facing camera, red Vantara GT in the lower third facing into the scene, Torre Sol whole in frame, boats floating on the sea, city behind, beach props (palms, umbrella, crates) in the foreground. |
| 2 | `drive` | Dusk, DOWNTOWN. Dario driving the GT east down avenue z=-48 inside a DOWNTOWN-only out-and-back loop (the district label can never flip), Hotel Marina beacon ahead, tower blade signs + setbacks, peds + traffic on the road. |
| 3 | `chase` | Night, PASAR SOL. Mission-4 escape, wanted 2, two cruisers closing behind the GT on the market road (out-and-back inside PASAR SOL, label stays correct). Head-on tracking camera, rain streaks, wet-road gloss from the headlight cone, police light bars, full HUD (minimap, speed, police panel, objective). |
| 4 | `complete` | Golden hour, MARINA. Mission complete +$350: Dario on foot by the GT on the north beach, pier + floating boats + whole lighthouse behind, MISI SELESAI toast, no police — the heat is off. |

## Controls

WASD / arrows — walk & drive · Shift — run · E — enter / exit (steal) car ·
mouse click / F — shoot · Space — handbrake · drag mouse — orbit camera ·
wheel — zoom · M — next mission · Enter — accept · P — pause.

## Determinism

- Seeded RNG (`mulberry32`, seed 7) for world, traffic and pedestrians; fixed
  staging coordinates for every shot; no `Math.random` in any staged path.
- No network: the game loads `three.module.min.js` from `game/vendor/` and
  nothing else. No post-processing composer, no external fonts.
- `?selftest=1` runs 14 scripted checks (world, traffic, walk, enter/drive/
  exit car, wanted + police, shoot, mission pickup + complete, save, wanted
  decay) and logs `SELFTEST PASS 14/14` to the console.
- `node main.ts` copies `game/` + `screenshots/` to the output dir and writes
  `dossier.json` (same bytes on every run for the same tree).
- Render a shot: `node serve.ts`, then headless Chrome
  `--screenshot --window-size=1280,720 --virtual-time-budget=10000
  "http://localhost:8080/index.html?shot=<name>&seed=7"`, converted to JPG
  1280x720, each file ≤ 256 KiB, exactly 4 shots in `screenshots/`.
