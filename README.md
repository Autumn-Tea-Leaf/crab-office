# savvy-progress (crab office edition)

A Claude Code mod: a progress bar above the prompt and a live panel of subagents, with a pixel office where they work. Made for the savvy-flow skill, and useful with any subagents.

Based on [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) by [johnnyvizz](https://github.com/johnnyvizz), from [claude-kit](https://github.com/johnnyvizz/claude-kit), under the MIT license. This fork adds a costume and a name per role, the crab roster, the office view with its departments, the lead crab at the front desk, and the day and night cycle.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install savvy-progress --marketplace Autumn-Tea-Leaf/crab-office
```

Answer `y` to add the marketplace, then pick a scope (user is the usual one). From a shell: `claude plugin install savvy-progress --marketplace Autumn-Tea-Leaf/crab-office`. In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Autumn-Tea-Leaf/crab-office`, then Add plugin.

The plugin keeps the original's name, `savvy-progress`, so its tools are still `mcp__savvy-progress__progress` and `mcp__savvy-progress__step`. If you have claude-kit's savvy-progress installed, disable it first so the two don't run side by side.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts.
- **Agents panel** (`/agents-info` toggles it; `/agents-info open` opens it or brings it forward without toggling): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time. Working crabs walk, and each savvy tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.

## Role costumes and names

- **Costume**: no agent wears the plain crab. `hooks/roles.ts` picks, in order: the role its `description` names (case-insensitive, first match wins); else its type (a `savvy-*` tier keeps its tier costume, `Explore` the explorer, a fork the builder, a type whose name spells a role that role); else a whimsical costume from a pool of 12, hashed from the agent id. The look is stored on the run at spawn.

  | Words in the description | Costume (idle animation) |
  | --- | --- |
  | contrarian | devil horns, pitchfork (pokes), tail (wags) |
  | first principles | mortarboard (tassel sways), chalk (scribbles) |
  | expansionist | rocket pack (floats, flame flickers), goggles |
  | outsider | traveller's hat, suitcase (swings) |
  | executor | cap, clipboard, stopwatch (ticks) |
  | peer review, reviewer, judge | judge's wig, gavel (bangs) |
  | chair, chairman | crown (jewels blink), sceptre (sparkles) |
  | council (any other seat) | laurel wreath (glints), toga, scroll |
  | motion, animation, video | film director: black beret, scarf, clapperboard (claps) |
  | design, designer, critique, polish, makeover | beret, palette, paintbrush (strokes) |
  | writer, writing, copy, copywriting, humanizer | spectacles, quill (scribbles), ink pot |
  | image, photo, gemini, picture, screenshot | photographer: bucket hat, camera (flash fires) |
  | fiverr, seller, sales, shop, gig, client, pricing | shopkeeper: straw boater, apron, coin (flips) |
  | verify, test, QA, validate, audit | lab coat, goggles, magnifier (scans) |
  | research, explore, search, find, look up | pith helmet, binoculars (scan) |
  | mod, plugin, code, coder | hacker hoodie, laptop (code blinks) |
  | build, builder | hard hat, hammer (swings) |

  The pool, for agents nothing describes (general-purpose, Plan, ...): pirate, wizard, spaceman, knight, ninja, cowboy, viking, beekeeper, magician, sailor, firefighter, party animal, each with its own idle motion.

- **Crab roster** (`hooks/roster.ts`): every role is one crab with a fixed name and a fixed look (costume + accent variant), kept in `~/.claude/crab-office/roster/crabs.json` (under `CLAUDE_CONFIG_DIR` when set). That file is outside every plugin folder, so updates never touch it; edit it by hand if you like (a file that does not parse, or that had twins, is copied to `crabs.json.bak-<time>` before it is rewritten).
  - **Role**: the keyword role of the description (`Council: The Contrarian` is Contrarian, `Council peer review 3` is Peer reviewer, `Mod: ...` is Mod engineer, `Humanizer ...` is Humanizer); a one-word specialty after it makes its own role (`Researcher: typography`); else a `Prefix:` the description starts with (`Ops: rotate keys` is Ops); else the type (general-purpose is Generalist, Explore is Explorer, `savvy-heavy` is Savvy heavy).
  - **File shape** (version 2): `{ "roles": [{ "role": "Designer", "crabs": [Coco, Mabel, Ruby, Taro, ...] }] }`, each crab `{ name, costume, variant, prop }`. A version 1 file is backed up and moved over on first load.
  - **New role**: gets a crab on first sight: an unused name (130, numbered after that) and a look no crab has: its role costume in another accent, then a free pool costume, then any costume, then more props.
  - **Same role at once**: slot 0 is the role's own crab, slot 1, 2... its siblings, each a crab of its own with its own name, in the same costume but a clearly different hue (`colors.ts` PALETTE: blue, red, green, orange, purple, teal, gold, pink, black, brown) and a different prop (the designer's held tool: brush, pencil, swatches, roller; then a floating charm: star, heart, note, bulb, flower, gem, balloon, leaf). The first concurrent agent of a role is always slot 0, the second always slot 1, and so on; a missing slot is created and saved.
  - **Costume designer** (description says costume, outfit, tailor, roster, sprite or crab): a tailor who codes: vest with a `</>` badge, measuring tape, pincushion, snipping scissors.
  - Seeded with: Contrarian Pepper (devil), First Principles Otto (professor), Expansionist Nova (rocket), Outsider Wren (traveller), Executor Dot (stopwatch), Peer reviewer Hazel (judge), Chairman Hugo (crown), Council Olive (toga), Designer Coco (magenta beret, brush) + Mabel (blue, pencil), Ruby (red, swatches), Taro (green, roller), Costume designer Bobbin (teal tailor), Motion designer Ziggy (director), Researcher Indy (explorer), Researcher: typography Fig, Explorer Juno, Builder Gus (hard hat), Mod engineer Pip (hacker), Writer Quill, Humanizer Honey, Photographer Kiki, Seller Penny (shopkeeper), QA Sage (lab coat), Generalist Bean (wizard).

- The row reads `Pip · Mod engineer`.

- **Office** (`hooks/office.ts`): the `▦ Office` button at the top of the panel (desktop only) swaps the rows for a pixel crab campus. The building grows a room for every team that has a crab, three rooms to a floor, with a corridor and stairs on the left. The ground floor (Lobby, Café, Lounge) is always there, with a garden out front: a pond with a duck, a fountain, a picnic table, flower beds and lamp posts. A floor that isn't full gets a Gym or a Greenhouse.

  | Costume | Room | Desks and errands |
  | --- | --- | --- |
  | explorer | Research Library | book stacks and lamps; bookcase, wall map, globe, reading chair |
  | artist, director, photographer, tailor | Design Studio | drawing tablets; mood board, photo backdrop with a flashing softbox, easel, dress form |
  | writer | Writers' Room | typewriters; cork board, window, crackling fireplace, armchair |
  | hacker, builder, savvy tiers | Dev Lab | dual monitors; blinking server racks, whiteboard, 3D printer |
  | scientist, detective | QA Lab | bubbling flasks; checklist, eyewash station, microscope, test tubes |
  | council seats | Council Chamber | green-felt benches with scrolls; seal, throne, lectern, golden scales |
  | shopkeeper | Shop Floor | cash registers; product shelves, sale sign, display rack, safe |
  | anyone else | Open Space | laptops; whiteboard, window, beanbags, water cooler |

  - **Running** agents sit at their department's desks and peek over them. Their bubble shows their latest tool call ("Editing app.json", "Reading README.md"), or their step note, and their name tag has a thin bar for step progress. Every so often they walk off on an errand: mostly to their own room's pieces, sometimes for coffee in the café, to the water cooler or printer, or for a chat at a colleague's desk. Four desks per department; overflow works in the Open Space.
  - **Finished** agents take a break: the café tables, the lounge (ping-pong, arcade, TV, sofa), the gym's treadmills, the greenhouse, or the garden. The twelve most recent are shown.
  - **Planned** tasks wait in the lobby, dimmed. **Failed** agents stand at the front desk with a red `!`.
  - **The lead**, the main session, is the plain original crab in brand clay, named Claude unless you set `leadName`. The lead sits behind the lobby's front desk with a bubble showing what the main session is doing ("Editing app.json"). During a turn, the lead visits each busy room to check on the team, then goes back to the desk. Between turns the lead waits for you and fetches a coffee now and then. The lead's row is always at the top of the list, with the same text.
  - **Look**: walls are sunk into the building with lit and shaded lips, each room has a papered or painted back wall over a skirting board, and floors are boards, tiles or carpet. Furniture is outlined and drops a shadow (one SVG filter per layer; animated pieces sit outside it), every block has a lit top edge, and crabs, trees and the building cast shadows. In the office view the panel redraws when agents change, not on every clock tick.
  - Every walk is a CSS animation, and each redraw starts it at the phase the clock gives, so crabs never snap back. The light follows your computer's clock in one 24-hour loop: daylight, a warm glow at dawn and dusk, and at night a dark garden with the lamp posts lit, warm ceiling lights in every room and hallway, and night skies in the windows. It moves without redrawing the panel, the same way the crabs walk. `prefers-reduced-motion` keeps everyone at home. `☰ Agents` switches back.

## Tools it adds

- `mcp__savvy-progress__progress`: the orchestrator reports the plan, phase and accepted tasks. Only the main session can: a call from a subagent is ignored, so a worker cannot rename, finish or reset the flow.
- `mcp__savvy-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead. The tool is listed up front rather than behind ToolSearch, and each `savvy-*` worker gets one line at the end of its brief asking for these reports.

Cost is a rough estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`, list prices as of 2026-10-10), not a bill. Cache writes are priced at the 1-hour rate, which is what Claude Code writes on a subscription; a session that writes 5-minute entries is overestimated there.

## Settings

`language`: `auto` (default), `en`, `ru` or `he`. Hebrew draws the bar and the panel right to left. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

`leadName`: the name of the main session's crab, `Claude` by default. Give it your own name for it, up to 24 characters.

`autoOpen`: `savvy` (default) or `any`. With `savvy` the panel opens by itself when a `savvy-*` worker starts or a plan is reported. With `any` it also opens, once per session, when any other subagent starts. `/agents-info` toggles it either way.
