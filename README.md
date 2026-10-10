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
6. Observation & graph (worked example table + graph)
7. MCQs (20 questions, choices reshuffled on load / reset)
8. Practical (simulated tray, voltmeter, record points, graph, true lines, start over)

## Physics model

Two plate electrodes in a 30 cm × 20 cm tray of conducting solution: − plate at x = 6 cm (0 V), + plate at x = 24 cm (6 V),
both from y = 6 to 14 cm, insulating tray walls. The potential is a numerical solution of Laplace's equation on a 0.25 cm grid
(`js/field-data.js`), read with bilinear interpolation. The worked example, the Practical voltmeter, the true equipotentials and
the field lines all come from this one grid.

## Files

- `index.html` — hash-routed views
- `css/styles.css`, `css/fonts.css` — theme; fonts vendored in `fonts/` (Sora, Source Sans 3, Kalam — SIL OFL)
- `js/app.js` — navigation, background, probe cursor, interactives, MCQs, Practical
- `js/field-data.js` — precomputed potential grid
- `assets/` — circuit diagram and defibrillator photo from the lab manual (graph paper is drawn as SVG)

Open `index.html` directly or serve the folder; no build step and no network needed.
