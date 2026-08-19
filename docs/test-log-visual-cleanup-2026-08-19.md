# Visual cleanup test log — 2026-08-19

## Home hero at local desktop preview

The redesigned Mafia invitation hero was inspected at `http://localhost:5175/` in RTL Persian. The previous orbit tokens and floating avatar badge are absent. The copy, two calls to action, and the private-room signal render as independent grid items with no overlap. The new Hero has an unobstructed text column and all controls remain visible.

## Catalog cleanup

The visible local catalog contains Mafia, Spyfall, UNO, Backgammon, Ludo, Codenames, Tic-Tac-Toe, Hokm, and FreeCell. Snakes & Ladders is not shown.

## Remaining validation

Verify that the Hokm move-log box is hidden within the migrated game, then perform production build and live deployment checks.

## Hokm move-log cleanup

The migrated Hokm game was opened directly at `http://localhost:5175/games/hokm/index.html` and a hand was started. After cards were dealt, the former movement-history panel below the cards was absent. The table, score counters, trump controls, and cards continued to render.
