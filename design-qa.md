# Design QA

**Source visual truth path**

- Current-task Codex Browser annotation captures for `index.html#result` (no local filesystem path supplied).

**Implementation evidence**

- Implementation: `/Users/hanwha/Documents/GitHub/aicamp/index.html#result`
- Implementation screenshot path: unavailable. The in-app Browser security policy blocked reloading the local `file://` page after the source edit.
- Target browser viewport: 932 × 1039 px, as recorded by the annotation captures.
- App content width: 500 CSS px maximum.
- Source density: browser annotation capture; device scale factor not exposed.
- Implementation density: unavailable because a current screenshot could not be captured.
- State: result summary screen with AI recommendation and all overview cards visible while scrolling.

**Full-view comparison evidence**

- Blocked: a current rendered implementation capture could not be produced after the source change.

**Focused region comparison evidence**

- Blocked for the AI recommendation label/copy/metric and tax, pension, downsizing, financial-operation, and inheritance metric rows for the same reason.
- Static structure checks confirm that each metric block is now a direct sibling of its heading card, with labels left-aligned and values right-aligned.

**Findings**

- [Blocked] Current visual evidence is unavailable.
  - Location: `index.html#result`.
  - Evidence: source annotations are available, but the in-app Browser rejected a refresh of the local `file://` URL.
  - Impact: exact visual fidelity, wrapping, and spacing cannot be signed off automatically.
  - Fix: manually refresh the existing in-app Browser tab and review the result screen at the recorded viewport.

**Comparison history**

- Iteration 1: moved the AI recommendation amount and all overview result rows outside their heading cards; changed result rows to label-left/value-right; increased AI label to 16px and explanation to 18px; changed the AI icon to orange.
- Post-fix visual evidence: blocked by the local `file://` refresh policy.

**Implementation Checklist**

- [x] AI recommendation label uses 16px type.
- [x] AI recommendation icon uses the orange theme color.
- [x] AI explanation uses 18px type.
- [x] AI recommendation metric is outside the heading card.
- [x] Tax values are outside the heading card and displayed as rows.
- [x] Pension, downsizing, financial-operation, and inheritance metrics are outside their heading cards.
- [x] Metric labels align left and values align right, including screens at or below 380px.
- [x] HTML structure, inline JavaScript syntax, and whitespace checks pass.
- [ ] Refresh and visually compare the current result screen.

**Follow-up Polish**

- Confirm long values such as `42억 2,700만원` remain on one line at the narrowest supported viewport.

final result: blocked
