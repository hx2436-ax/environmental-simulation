# Corner — 3D Convenience Store

A separate vanilla JavaScript / Three.js simulation alongside the Uber project. Open `convenience-store/` through an HTTP server or GitHub Pages. CDN and Google Fonts require internet access.

Nine dedicated shelf categories, mixed individual packages at (1,1), adjustable quantity/weight/carrying capacity, automatic delivery, pause/resume/replay, route display and trip manifests. Every trip includes return to the depot. Grid spacing is one meter; shelf cells are obstacles. Delivery happens at each shelf's front cell. Objective: total walking distance, excluding handling time.

BFS computes aisle distances. Held–Karp computes exact tours for all category subsets. Up to 14 individual items, subset partition DP finds the global minimum total distance. Larger inputs use four packing candidates with minimum marginal route-cost insertion; the best candidate is shown with an explicit approximation label. Exact per-trip tours do not imply a globally optimal packing. Inputs allow 0–12 pieces per category, with weights rounded to 0.01 kg. Items heavier than carrying capacity are rejected.

Run checks: `node convenience-store/test.mjs`. Serve repository root via any static HTTP server. All configuration is browser-local and resets on reload.
