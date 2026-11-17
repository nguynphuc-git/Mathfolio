# Geometry proof validation

The geometry workspace accepts a reviewed PDF/image problem or pasted text/LaTeX, then builds a declarative diagram from the hypotheses. Green solid lines represent given objects. Violet dashed lines represent optional auxiliary constructions, initially hidden and revealed with hint level 2 or the explicit toggle. Spatial scenes use 3D coordinates and adjustable viewing angles.

Four built-in examples use exact local constructions without model initialization. Other problems use the selected AI route. Cloud requests require explicit Cloud AI consent. Malformed scenes, impossible intersections, violated declared relations and truncated responses are rejected. Editing the problem or changing its illustrations invalidates the existing diagram.

## Sourced contest cases

Inputs are paraphrased in `tests/fixtures/geometry-contests.ts` with source links.

| Case | Source | Checks |
| --- | --- | --- |
| IMO 1968, problem 4 | [Official problem paper](https://www.imo-official.org/assets/documents/problems/1968/1968_eng.pdf) | Spatial existence proof remains a proof task after LaTeX conversion; an irregular tetrahedron sanity check; no regularity assumption. |
| IMO 1970, problem 5 | [Official problem paper](https://www.imo-official.org/assets/documents/problems/1970/1970_eng.pdf) | Plane projection, orthocenter and perpendicularity constraints; unequal-axis and equality configurations; invalid configurations rejected. |
| ASMO 2022 International Round, Secondary, problem 25 | [Organizer's sample paper](https://drive.google.com/file/d/1K4iV1-ueLUCpTjMdWUqAZ-0hqmuRudaP/view), linked from the [organizer's ASMO page](https://globalolympiadsacademy.com/asmo/) | Right trapezoid, midpoint, line intersection and published ratio 10. This is a **plane geometry** comparison case, not a spatial proof problem. |

The regression scenes are human-authored fixtures. Passing these tests validates the construction engine and input pipeline; it does not show that a model independently solved those contest problems. Numerical checks of a few configurations are not proofs.

## Proof review criteria

- IMO 1968 P4: let AB be a longest edge. If the incident lengths at both A and B fail the strict triangle inequalities, then AB >= AC + AD and AB >= BC + BD. Adding the strict face inequalities AC + BC > AB and AD + BD > AB gives a contradiction. No regularity assumption is needed.
- IMO 1970 P5: first derive pairwise perpendicularity of DA, DB and DC from the projection/orthocenter hypotheses. Then apply Cauchy to AB + BC + CA and Pythagoras to the three face edges. Equality occurs when DA = DB = DC. A drawing or measured values cannot replace these steps.
- Auxiliary objects must be justified constructions, never extra assumptions. A target circle must not appear as a given when concyclicity is what must be proved.

## Test coverage and limits

- Unit tests cover exact tangency, circle and line intersections, circumcenters, plane projection, relation validation, malformed model output and persistence.
- UI tests cover source pasting, reviewed PDF import, explicit diagram generation, hint context, auxiliary reveal, stale diagram invalidation and cancellation.
- AI boundary tests cover local routing, uploaded image input, explicit cloud consent, malformed/truncated output, input-capacity errors and cancellation. These tests mock inference.
- On 17 November 2026, a direct local attempt for IMO 1970 P5 in the integrated Chromium browser returned `QuotaExceededError`. A separate minimal native prompt confirmed that this browser only exposes Chromium's echo implementation: “On-device model is not available in Chromium”. No live local-model proof benchmark passed in this environment. Test the actual model in supported Chrome before relying on its extraction or hints.
- The scene validator checks relations declared in the scene. It cannot prove that AI extracted every hypothesis correctly; the interface asks the learner to review the extracted givens and explicitly displays unresolved assumptions.
- Circles currently lie in planes parallel to the xy plane. Arbitrarily oriented spatial circles and unsupported loci must be reported as unresolved. A diagram is illustrative, not a symbolic proof certificate.

Run `npm test` and `npm run build`. For manual Chrome testing, open the local development URL, choose a geometry example or paste one problem, click **Create diagram**, review **Given** and **To prove**, then request hint levels 1 and 2. For a spatial problem, rotate and tilt the view. Modify the statement and confirm that the old diagram is removed before generating a replacement.
