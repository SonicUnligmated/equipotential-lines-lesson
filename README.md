This README is AI-generated.

# Lab 7A · Mapping of Equipotential Lines

Static, offline-ready lesson site for the college physics practical **7A. Mapping of Equipotential Lines**.

https://sonicunligmated.github.io/equipotential-lines-lesson/

## Sections

1. Aim & outcomes
2. Equipotential lines (interactive field: equipotential and field line through the probe)
3. Medical perspectives (tissue fields / ECG, defibrillation, electrotherapy, electrode design)
4. Method (click a step; diagram on the right)
5. Formula (Coulomb's law explorer: q1, q2, r → F)
6. Observation & graph (example table + graph, generated from the field model)
7. MCQs (20 questions, choices reshuffled on load / reset)
8. Practical (simulated tray, voltmeter, record points, graph, true lines, start over, guided tutorial with pause and speed controls)

## Physics model

Two small plates (1.2 cm high) in a wide, shallow tray of conducting solution: − plate at x = −10 cm (0 V, reference),
+ plate at x = +10 cm (3.9 V), both centred on y = 0. The graph board runs from −5 to +5 cm in x and y with the origin at its
centre, so the board's centre sits at 1.95 V and the 1.7–2.2 V equipotentials fall across the board.

Each plate is treated as a thin conductor of equivalent radius a = 0.3 cm (a flat strip of height h has equivalent radius h/4).
For two such conductors with centres 2d = 20 cm apart, the exact 2-D potential is that of two line charges at x = ±b,
b = √(d² − a²):

    V(x, y) = 1.95 V + 3.9 V · ln(r₋ / r₊) / (2 · acosh(d / a))

The worked example, the Practical voltmeter, the table autofill, the true equipotentials and the field lines all come from this
one formula (contours via marching squares on a 0.1 cm grid).

Practical table: target voltages 1.7–2.2 V (defaults 1.8, 1.9, 2.0, 2.1 V), x and y from −5 to +5 cm. Pressing Enter in a row
fills its empty (x, y) pairs from the field model (spread over y = −4.5, −1.5, 1.5, 4.5 cm, skipping values already used);
typed cells are never overwritten. The guided tutorial maps whatever voltages are set in the table.

## Files

- `index.html` — hash-routed views
- `css/styles.css`, `css/fonts.css` — theme; fonts vendored in `fonts/` (Sora, Source Sans 3, Kalam — SIL OFL)
- `js/app.js` — navigation, background, probe cursor, interactives, MCQs, Practical
- `assets/` — circuit diagram and defibrillator photo from the lab manual (graph paper is drawn as SVG)

Open `index.html` directly or serve the folder; no build step and no network needed.
