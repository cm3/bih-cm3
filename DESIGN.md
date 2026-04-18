# BIH App Design Notes

## Scope
- This document defines the visual and interaction constraints for `bih-app`.
- It is a working design brief, not a strict external specification.
- Content copy and collection-specific labels should live in data, not here.

## Product Roles
- Viewer is for people who came to inspect a bibliography or reference list.
- Editor is for people who curate hub entry data and presentation copy.
- Viewer and Editor should feel like the same application, not two unrelated tools.

## Core Principles
- Prioritize readable bibliography browsing over dashboard density.
- Keep the interface calm, document-like, and closer to a reading tool than an admin console.
- Preserve a WYSIWYG feeling in Editor whenever fields are simple text.
- Show differences in role through relation and tone, not heavy hierarchy.
- Keep linked-data richness available, but do not force users to traverse structure just to understand what a link is.

## Layout
- The left column is the collection list.
- The right column is the selected entry detail.
- This left/right structure should stay stable in both Viewer and Editor.
- Editor may expose controls inline and through modals, but should not introduce a separate management dashboard panel by default.
- The top bar should stay shallow and act as framing, not as a command center.
- The top bar should read as a full-bleed band attached to the viewport edges, not as a floating rounded card.

## Viewer
- Viewer should speak in terms of the bibliography collection, not implementation terms.
- Avoid exposing terms like `hub entry`, `viewer mode`, `index`, or similar technical framing in the main reading UI.
- The collection context should be clear near the top of the screen.
- Links should be understandable at a glance.
- If a linked target has a short explanation, show it like a search-result snippet under the link.

## Editor
- Prefer inline editing for plain strings such as titles, descriptions, and collection copy.
- Use blur-triggered save for simple text edits where the risk of accidental change is low.
- Use modals for structured or multi-field editing such as extended link metadata.
- Link editing should expose `property` and `value` directly in the main detail pane.
- Link property inputs should suggest controlled vocabulary values, while still allowing deliberate manual entry.
- Inline editing must preserve readable spacing and should not collapse or overlap the surrounding reading layout.

## Visual Language
- Use a warm, paper-adjacent palette rather than default app chrome.
- Borders should be light and low-contrast.
- Rounded panels are acceptable, but avoid overly soft or playful styling.
- Titles and descriptions should dominate; metadata should read as secondary.
- Context entries may use muted gray styling to signal a different role without removing them from the main visual system.
- The top bar may be flatter and more architectural than the main panels; the contrast between a full-bleed band and rounded reading panels is intentional.
- Link editing cards may feel slightly more structured than the surrounding metadata, but they should still stay within the same material system.

## Theming
- Theme changes should start from shared CSS custom properties rather than ad hoc color edits in component styles.
- `src/ui/styles/base-styles.ts` is the primary theme surface for color, panel tone, control tone, selected state, and radius values.
- `shell/detail/modal` styles may define layout and component-specific composition, but they should prefer shared variables for visual values.
- A fork that wants a different palette should be able to get most of the way there by editing the variables in `base-styles.ts`.
- Hard-coded colors in feature styles should be treated as exceptions and reduced over time.

## Interaction Tone
- Avoid noisy badges, excessive chips, and dense toolbars.
- Prefer a few clear actions over many always-visible controls.
- Keep motion subtle and functional.
- Empty states and save states should be concise and calm.

## Avoid
- Viewer text that explains the implementation instead of the bibliography.
- UI that looks like a generic CMS or admin console.
- Over-segmenting detail content into too many cards.
- Deep nesting in the main reading flow.
- Requiring users to know linked-data internals to understand ordinary actions.

## Separation Of Concerns
- `DESIGN.md` stores enduring design intent and constraints.
- Data files store collection-specific copy and display configuration.
- Component code and CSS implement the current expression of these rules.
