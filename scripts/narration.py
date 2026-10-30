# -*- coding: utf-8 -*-
"""
Narration + scene plan for "The Terrifying Journey to Alpha Centauri".

Each sentence is either a plain string (shown and spoken identically) or a
tuple (shown_text, spoken_text) when numbers need spelling out for the TTS.

Scene fields
  id      : which Three.js scene to render (see web/src/scenes/*.js)
  title   : chapter title shown on screen
  cards   : on-screen fact cards  -> (sentence_index, label, value[, span])
  sentences : narration

Facts (checked against web sources, Oct 2026)
  * Alpha Centauri AB ~4.37 ly, Proxima ~4.24 ly (~40 trillion km)
  * Voyager 1: launched 1977, interstellar space 2012, ~17 km/s, ~75,000 yr
  * Parker Solar Probe ~692,000 km/h -> ~6,800 yr
  * Proxima b: discovered 2016, 11.2 d orbit, ~7 million km, habitable zone
  * ALMA flare 24 Mar 2017: ~1000x brighter in ~10 s (millimetre light)
  * JWST candidate around Alpha Cen A: ~2 AU, seen Aug 2024, not re-found 2025
  * Breakthrough Starshot: $100M, 2016, ~100 GW laser, gram-scale chip,
    0.2 c (~215 million km/h), ~20 yr, 1 W laser comms, ~1e9 dust hits/sail
  * Relativistic flip-and-burn at 1 g: ~3.6 yr ship time, ~6 yr Earth time,
    peak speed ~0.95 c
"""

MAIN = {
    "mode": "main",
    "title": "The Terrifying Journey to Alpha Centauri",
    "target_total": 480.0,      # seconds, pads are stretched to hit this
    "lead": 1.6,                # silence before first sentence of a scene
    "tail_min": 1.6,            # minimum silence after the last sentence
    "gap": 0.30,                # silence between sentences
    "speed": 0.96,              # Kokoro speaking rate
    "scenes": [
        {
            "id": "hook", "title": "Prologue",
            "cards": [(3, "NEAREST STAR SYSTEM", "Alpha Centauri"),
                      (6, "DISTANCE", "≈ 40 trillion km")],
            "sentences": [
                "Look up at the night sky.",
                "Near the southern horizon, a bright star shines.",
                "It looks calm. It looks close. It is not.",
                "That point of light is Alpha Centauri, the nearest star system to our Sun.",
                "And the journey to reach it may be the most terrifying voyage humanity has ever imagined.",
                "In the next eight minutes, we will fly there.",
                ("We will cross 40 trillion kilometres of darkness, and meet the dangers waiting in the void.",
                 "We will cross forty trillion kilometres of darkness, and meet the dangers waiting in the void."),
                "Stay until the end, because the last part changes how you see the stars.",
            ],
        },
        {
            "id": "voyager", "title": "Chapter 1 · The Farthest Explorer",
            "cards": [(1, "VOYAGER 1", "Launched 1977 · Interstellar 2012"),
                      (2, "SPEED", "≈ 17 km/s"),
                      (3, "TIME TO ALPHA CENTAURI", "≈ 75,000 years"),
                      (5, "PARKER SOLAR PROBE", "≈ 6,800 years")],
            "sentences": [
                "Let's start with the farthest explorer we have ever sent toward the stars.",
                "Voyager 1 launched in 1977, and entered interstellar space in 2012.",
                "It travels at about seventeen kilometres every second, many times faster than a rifle bullet.",
                "Yet if it were aimed at Alpha Centauri, it would need around seventy-five thousand years to arrive.",
                "Seventy-five thousand years ago, no city, no farm, and no written word existed anywhere on Earth.",
                "Even the Parker Solar Probe, the fastest machine ever built, would take nearly seven thousand years.",
            ],
        },
        {
            "id": "distance", "title": "Chapter 2 · The Distance",
            "cards": [(1, "ALPHA CENTAURI A + B", "4.37 light years"),
                      (3, "IN KILOMETRES", "≈ 40,000,000,000,000"),
                      (4, "IN ASTRONOMICAL UNITS", "≈ 270,000 AU"),
                      (5, "SUN = 1 mm GRAIN", "Next star ≈ 30 km away")],
            "sentences": [
                "So how far is it, really?",
                ("Alpha Centauri lies about 4.37 light years away.",
                 "Alpha Centauri lies about four point three seven light years away."),
                "Light, the fastest thing in the universe, needs more than four years to make this trip.",
                "In kilometres, that is roughly forty trillion.",
                "Or, in units our Solar System understands, about two hundred and seventy thousand times the distance from the Earth to the Sun.",
                "Shrink the Sun to a single grain of sand, and the next star would still be nearly thirty kilometres away.",
            ],
        },
        {
            "id": "system", "title": "Chapter 3 · Three Suns",
            "cards": [(1, "A + B ORBIT", "Every 80 years"),
                      (2, "PROXIMA CENTAURI", "Red dwarf · ≈ 0.2 ly from A + B"),
                      (3, "PROXIMA'S DISTANCE", "4.24 light years")],
            "sentences": [
                "And what waits there? Not one star, but three.",
                "Alpha Centauri A and B are sun-like stars that circle each other once every eighty years, roughly as far apart as the Sun and Uranus.",
                "Far beyond them, about a fifth of a light year away, a small red dwarf called Proxima Centauri drifts along.",
                ("At 4.24 light years, Proxima is the closest star to us of all.",
                 "At four point two four light years, Proxima is the closest star to us of all."),
                "Yet it is so dim that you can never see it without a telescope.",
            ],
        },
        {
            "id": "proxima", "title": "Chapter 4 · A World Called Proxima b",
            "cards": [(1, "PROXIMA b", "Rocky · Habitable zone · Found 2016"),
                      (2, "ORBIT", "11.2 days · ≈ 7 million km"),
                      (3, "ALMA · 24 MARCH 2017", "Flare: ×1000 in 10 seconds"),
                      (5, "JWST CANDIDATE", "Giant planet at ≈ 2 AU"),
                      (6, "STATUS", "NOT CONFIRMED")],
            "sentences": [
                "Around that little star circles a world astronomers cannot stop thinking about.",
                "Proxima b, discovered in 2016, is a rocky planet with roughly the mass of Earth, sitting in the habitable zone where liquid water could exist.",
                "But look closer. It orbits its star every eleven days, about eight times closer than Mercury is to our Sun.",
                "And its star is violent. In March 2017, a single flare made Proxima a thousand times brighter in radio light, in just ten seconds.",
                "Flares like that could strip away an atmosphere, and sterilise a surface.",
                "And around Alpha Centauri A, the James Webb telescope spotted a faint dot in 2024: a possible giant planet, about twice as far from its star as Earth is from the Sun.",
                "It was seen only once. For now, it remains a candidate, not a confirmed world.",
            ],
        },
        {
            "id": "speed", "title": "Chapter 5 · The Speed Problem",
            "cards": [(2, "AT 0.1 c", "≈ 44 years"),
                      (2, "AT 0.2 c", "≈ 22 years", 1)],
            "sentences": [
                "So the destination is real. The problem is speed.",
                "To arrive within a human lifetime, we would need to travel at a serious fraction of the speed of light.",
                "At ten percent of light speed, the trip takes about forty-four years. At twenty percent, about twenty-two.",
                "But rockets that carry their own fuel cannot come close to those speeds.",
                "So engineers asked a radical question: what if the ship carried no fuel at all?",
            ],
        },
        {
            "id": "starshot", "title": "Chapter 6 · Breakthrough Starshot",
            "cards": [(0, "BREAKTHROUGH STARSHOT", "2016 · $100 million"),
                      (1, "LASER ARRAY", "≈ 100 gigawatts"),
                      (2, "EACH PROBE", "≈ 1 gram chip + light sail"),
                      (3, "TOP SPEED", "20% of light · ≈ 215 million km/h"),
                      (4, "TRAVEL TIME", "≈ 20 years")],
            "sentences": [
                "In 2016, Yuri Milner announced, alongside Stephen Hawking, Breakthrough Starshot, a hundred million dollar research program.",
                "The idea: build the most powerful laser array ever made, around a hundred gigawatts.",
                "Then use it to push a fleet of tiny probes, each a chip weighing about a gram, attached to a mirror-like sail.",
                "In just minutes, the laser would blast them up to twenty percent of the speed of light, more than two hundred million kilometres per hour.",
                "They would reach Alpha Centauri in about twenty years.",
                "And their pictures would need another four years to travel home.",
            ],
        },
        {
            "id": "dust", "title": "Terror One · Dust",
            "cards": [(3, "DUST HITS PER SAIL", "≈ 1,000,000,000"),
                      (4, "ONE 1 mm GRAIN AT 0.2 c", "Dozens of kg of TNT")],
            "sentences": [
                "But the space between the stars is not empty.",
                "It is filled with thin gas, and tiny grains of dust.",
                "At normal speeds, they are harmless. At twenty percent of light speed, every grain becomes a bullet.",
                "A single sail could be struck by around a billion dust particles on the way.",
                "And a grain just one millimetre across would hit with the energy of dozens of kilograms of TNT.",
                "A big ship could be destroyed in an instant. For the tiny sails, the plan is a numbers game: launch thousands, and hope some survive.",
            ],
        },
        {
            "id": "radiation", "title": "Terror Two · Invisible Fire",
            "cards": [(1, "COSMIC RAYS", "Fast charged particles"),
                      (3, "SHIELD AT HIGH SPEED", "Several metres thick")],
            "sentences": [
                "There is a second killer, and you cannot see it.",
                "Space is threaded with cosmic rays, fast charged particles that raise the risk of cancer even on short missions.",
                "At relativistic speed, it gets worse: even a single hydrogen atom slams in so hard that, from the ship's point of view, it acts like a cosmic ray.",
                "Analyses of fast starships find that a crew at very high speed would need a shield several metres thick, just to survive the gas it flies through.",
            ],
        },
        {
            "id": "relativity", "title": "Terror Three · Time Itself",
            "cards": [(0, "THOUGHT EXPERIMENT", "Crewed ship · 1 g flip-and-burn"),
                      (3, "SHIP CLOCK vs EARTH", "≈ 3.6 years vs ≈ 6 years"),
                      (4, "PEAK SPEED", "≈ 0.95 c")],
            "sentences": [
                "Now imagine the impossible: a crewed ship that accelerates at one g, the same pull you feel standing on Earth.",
                "Halfway there, it flips around, and brakes.",
                "No engine we know could do this. But the physics is clear.",
                "The crew would age about three and a half years, while about six years pass on Earth.",
                "At the midpoint, they would be moving at ninety-five percent of the speed of light.",
                "Outside the window, the stars crowd into a blazing blue ring ahead, while the sky behind fades to a dull, red darkness.",
            ],
        },
        {
            "id": "arrival", "title": "The Arrival · One Shot",
            "cards": [(1, "FLYBY SPEED", "≈ 35 AU per day"),
                      (3, "DATA LINK", "1 watt laser · 4+ years home")],
            "sentences": [
                "If a Starshot probe survives, it gets exactly one chance.",
                "It cannot slow down. It will tear through the system at about thirty-five times the Earth–Sun distance every day.",
                "In those few precious hours, its tiny camera would take the first close-up pictures of another star system.",
                "Then a one-watt laser would send them home, a whisper crossing four light years of darkness.",
                "And after that, the probe vanishes into the dark, forever.",
            ],
        },
        {
            "id": "finale", "title": "Epilogue",
            "cards": [(5, "NEAREST SHORE", "4.37 light years")],
            "sentences": [
                "So, is the journey to Alpha Centauri possible?",
                "Not yet. Dust, radiation, and the sheer distance still stand in the way.",
                "But the first steps are happening right now: the lasers, the sails, and the telescopes hunting for planets.",
                "We are a species that once crossed oceans in wooden boats.",
                "The ocean between the stars is wider, and darker, and colder.",
                "But the nearest shore is only four light years away.",
                "If you enjoyed this journey, subscribe to Technical Talk India, and tell us in the comments: would you board that ship?",
            ],
        },
    ],
}

SHORTS = {
    "mode": "shorts",
    "title": "The Terrifying Journey to Alpha Centauri (Short)",
    "target_total": 56.0,
    "lead": 0.35,
    "tail_min": 0.35,
    "gap": 0.18,
    "speed": 1.04,
    "scenes": [
        {
            "id": "distance", "title": "ALPHA CENTAURI",
            "cards": [(0, "DISTANCE", "≈ 40 trillion km"),
                      (1, "VOYAGER 1", "≈ 75,000 years")],
            "sentences": [
                "Alpha Centauri is the nearest star system to us, forty trillion kilometres away.",
                "Voyager 1 would need seventy-five thousand years to get there.",
            ],
        },
        {
            "id": "starshot", "title": "THE CRAZY PLAN",
            "cards": [(0, "LASER", "≈ 100 gigawatts"),
                      (2, "TOP SPEED", "20% of light speed")],
            "sentences": [
                "So scientists propose something crazy.",
                "A hundred-gigawatt laser, pushing a chip-sized probe on a mirror sail.",
                "Twenty percent of light speed. Twenty years to arrive.",
            ],
        },
        {
            "id": "dust", "title": "THE TERROR",
            "cards": [(1, "ONE DUST GRAIN", "Dozens of kg of TNT")],
            "sentences": [
                "But space isn't empty.",
                "At that speed, a single grain of dust hits like a bomb.",
                "And every atom becomes a bullet.",
            ],
        },
        {
            "id": "arrival", "title": "ONE SHOT",
            "cards": [(1, "SIGNAL HOME", "4+ years")],
            "sentences": [
                "If the probe survives, it gets one chance: a few hours to photograph Proxima b, a world that may have liquid water.",
                "Then four years for the pictures to reach Earth.",
            ],
        },
        {
            "id": "finale", "title": "WOULD YOU GO?",
            "cards": [],
            "sentences": [
                "Would you board that ship?",
                "Follow for more space journeys.",
            ],
        },
    ],
}
