# Molly Hole Game — Design Plan (v0.3: grounded city look)

A gentle game for Molly (5) that looks like a proper grown-up casual game, the kind she enjoyed on her mum's phone. You drag a hole around a big, real-feeling city. It swallows anything smaller than itself, grows, and then it can swallow bigger things.

## Where it happens: Harbour Heights
**Harbour Heights** is an original, believable downtown with glass and concrete high-rises, wide roads, crossings, traffic lights, taxis, buses, plazas with trees, benches, bins, lamp posts and bollards, seen from a high angle. You start among the towers at street level. Later rounds work up to swallowing whole buildings and finally a skyscraper.
- Ducks, pigeons, cats and dogs are friends: they trot, waddle or flap away from the hole and are **never swallowed**.
- **No people are ever swallowed.** Streets have no pedestrians near the hole.

## Living world (applies to every world)
Nothing just sits there waiting. The world moves on its own so there is always something to chase:
- **City (Harbour Heights):** cars, taxis, buses and lorries drive along the roads and stop at lights. Pedestrians walk the pavements but always step well clear of the hole and are **never swallowed**. Pigeons, ducks, cats and dogs scurry away.
- **Desert Island (later world):** **dinosaurs roam around**: small ones scamper, big ones stomp slowly. They're friendly and cartoon-calm, never roaring at the screen. They fit the size rules (a little raptor-sized one early, a long-neck one last). Palm trees, beach huts, boats and crates sit around too.
- **Moon Base / Planet (later world):** **spacecraft and space buggies fly and drive about**: rovers trundle, shuttles hover and land, small craft zip overhead. **Aliens wander around** too: friendly, wobbly, curious, never scary. Domes, antennas, rocks and crates make up the rest. **Astronauts are people: never swallowed**; they bounce away.
- Moving things slow down a little when the hole is near, so a 5-year-old can catch them.

## Worlds and the start map
- **Start map:** a floating map where Molly taps or drags her hole token along a path of round level stops (see `concepts/v4-03-start-map.jpg`). Finished stops show stars. Gift-box stops are bonus levels. Locked stops show a padlock and open as she plays, never by paying.
- **Worlds, in order:** Harbour Heights (high-rise city, the start), Thornbury village (countryside: cottages, church, tractors, ducks), more city districts, Desert Island (roaming dinosaurs), Moon Base (flying spacecraft, rovers, wandering aliens).

## Level types
- **Normal:** grow and swallow until the big finale object drops in.
- **Order puzzle:** a picture strip at the top shows what to swallow first, second, third (e.g. bin → bench → tree → car). The next item glows with a number badge and a dotted trail leads to it. Swallowing the wrong thing just bounces back out gently. No penalty.
- **Bonus level:** a golden plaza full of coins and gift boxes. Swallow freely for extra coins. No goal and no timer.
- **Timed level (soft timer):** a colour ring with no numbers fills slowly. Finishing before it fills gives extra **coins**. When it fills, nothing fails: a big green **Continue** arrow lets her keep playing to the end, and a door **Exit** button goes back to the map. Pause and Home always work, and pausing stops the ring.

## Rewards
- **Stars** come from finishing levels and swallowing things. **Coins** come from bonus levels and from clearing timed levels in time.
- Stars and coins **unlock** skins and boosts in the wardrobe. They're earned in play only, never bought, and there's no shop for real money.

## Core loop
1. Put your finger anywhere and drag. The hole follows your finger.
2. Things smaller than the hole tip and slide in.
3. Each swallow fills the **size bar**. When it's full, the rim pulses and the hole grows.
4. Bigger hole → bigger things fit: cones and bins → benches and trees → cars and taxis → buses and lorries → kiosks and small shops → office blocks → skyscraper.
5. Swallowed things give **stars**, and timed and bonus levels give **coins**. Both unlock hole skins.

## Swallow and growth rules (kid-simple)
- Every object has a size from 1 to 8. The hole has a size level.
- If the object is the same size as the hole or smaller, it falls in, tilting and sliding with weight.
- Too big? It just teeters on the rim. Nothing bad happens.
- Each level takes a bit longer, but never needs grinding: roughly 30–60 seconds of play.
- No losing, no lives, no fail state.

## Modes
- **City Run (default):** a short round (~3–4 minutes, no visible countdown) that ends when the skyscraper drops in → fireworks over the skyline → home with stars.
- **Free Play (endless):** the city slowly refills; keep going as long as you like.

## Upgrades and skins (earned stars and coins only, never real money)
- Skins: Blue Glow (free), Tiger Stripe, Stone Well, Molten Gold, Galaxy, Neon, Ice Crystal. Stylish and grounded, not toy-like (see `concepts/v3-03-hole-skins.jpg`). Each costs 5–30 stars, so one unlocks every round or two.
- Each skin has its own gentle swallow sound (tiger: low friendly purr, ice: soft chime).
- "Start bigger" boost: spend stars to begin a round one size up.
- Stars are saved on the device only.

## Controls and UI
- Drag anywhere; the hole glides smoothly to your finger. Mashing the screen just moves it, never breaks it. The first finger wins and other touches are ignored.
- Clean, modern, adult-casual look: dark see-through round buttons with white icons, a slim size bar with a hole icon, and a star counter top right (see `concepts/v3-04-ui-city.jpg`).
- Pause and Home always visible top-left, at least 80 px, inside iPad safe areas. Pause freezes everything and shows a big Play button.
- No reading needed: icons only. A faint swipe arrow shows how to drag at the start.
- Works in landscape and portrait, aiming for 60 fps on iPad.

## Art and sound
- Stylised, semi-realistic 3D-look city: natural daylight, believable glass, concrete and tarmac, soft shadows, readable at a glance. Not photoreal, not toy-like, no nursery pastels.
- The hole is a clean round black opening with a glowing rim and light cracks in the road around it.
- Satisfying physics: things tilt, slide and drop with weight, and the camera eases out as the hole grows. No faces on objects.
- Sounds: satisfying low thunks and whooshes, a rising chime on growth, calm upbeat music; mute on the home screen. All sounds are made fresh, nothing copied.
- Gentle for a 5-year-old: no horror, blood, screams, scary faces or collapsing-with-people imagery. Buildings drop neatly into the hole, with no dust clouds or wreckage.

## v1 scope
**In:** one Harbour Heights city map with moving traffic and pedestrians (who never get swallowed), the drag hole, 8 size levels, ~12 object types (cone, bin, bench, tree, lamp post, car, taxi, bus, kiosk, small shop, office block, skyscraper), size bar, stars, City Run and Free Play modes, 4 skins (Blue Glow, Tiger Stripe, Galaxy, Ice Crystal), pause/home, sounds and mute, save on device, offline web app (add to Home Screen on iPad).
**Later (beyond v1):** the start map with more levels, order-puzzle, bonus and timed levels, Thornbury village, Desert Island world with roaming dinosaurs, Moon Base world with flying spacecraft, rovers and wandering aliens, more city areas, more skins, a collection book of things swallowed, a night-time city.

## Not doing (ever)
No ads. No in-app purchases. No App Store links or buttons. No tracking or analytics. No accounts or logins. No pop-ups or nags. No forced timers that stop play. No scary content, and no people or pets swallowed. No art, names, sounds or levels copied from any shop-bought game.
