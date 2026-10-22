# Education Admin Hub — concept prototype

Clickable concept prototype of a Microsoft Education admin experience. Not a shipping product; all tenant data is sample data.

Live: https://jesegher.github.io/edu-admin-hub-prototype/

## Try the demo

- **Curriculum grounding:** under Connectors & data, enable grounding for Teach
  module and add/remove SharePoint Online site URLs. Save/Cancel explicitly
  separates drafts from saved settings; disabling retains the saved URL list.
  Study and Learn is labeled coming later and has no active grounding control.
  Teach's app setting, the connector catalog and guided setup link to the same
  editor (`#curriculum`). Grounding configuration is saved separately from
  guided setup; it is not silently overwritten by applying a setup draft.
  If Teach is off, the editor identifies that dependency without discarding
  configuration. Existing saved demos receive an empty, disabled configuration.
  The former generic curriculum connector routes here rather than offering a
  separate consent flow with no site list.
  Validation requires at least one URL when enabled and rejects malformed,
  non-HTTPS, non-SharePoint, OneDrive personal-site, credential-bearing,
  duplicate, document/sharing and query/fragment URLs. Public, government,
  China and legacy Germany SharePoint hostname suffixes are accepted for
  format checking; this does not assert deployment availability in those clouds.
  Validation checks syntax only, not site existence, tenant ownership,
  permissions or access. Use fictional URLs: nothing is fetched, indexed or
  contacted, and the saved list stays in browser storage. The existing
  Canvas-based learning-data readiness check is unchanged.
- **Admin center menu:** the surrounding Microsoft 365 menu follows the
  owner-provided reference image. Education is one expandable top-level entry,
  between Apps and Teams & groups, with the five working Education destinations
  nested underneath. The hamburger collapses/expands navigation. Other admin
  areas expand to a clearly labeled demo-boundary action rather than pretending
  to offer live management features. On mobile, selecting an Education page
  closes the menu; the hamburger reopens it.
- **Overview:** four-area sample readiness assessment, action-first ordering,
  simplified navigation cards, and an audit-log handoff rather than a separate
  Recent changes feed. Production audit coverage is not asserted. The student
  age-group counts, timestamp, breakdown and readiness update together
  automatically after saved sample classification changes. There is no manual
  refresh action or 24-hour delay in this version. A visible note labels
  automatic refresh as proposed behavior subject to engineering validation,
  not a confirmed product capability. The **Quick overview** section groups
  institution type and student, educator and school totals. Status badges use
  red for **Action needed** (including action counts) and yellow for
  **Needs review** (including nonzero review counts), in light and dark themes.
- **Guided setup:** review institution type, age classification, nine app settings
  and data connections. Counts reflect saved data on the age-group and review
  steps. Draft selections and previews never alter counts; applying
  classification updates counts and readiness automatically, including the
  completion screen. Apply only differences. The standalone
  experience remains the baseline/fallback; a visible information callout marks
  Microsoft 365 guided setup integration as under exploration.
- **Student safety:** open independent classification methods, search and select
  multiple sample groups per age group, edit group or grade mappings,
  simulate CSV validation/import, preview illustrative counts and apply sample
  classifications. Applying classification updates counts, breakdowns,
  readiness and timestamps together. Opening a method, editing a mapping, or
  validating a CSV does not itself classify students.
  No real files are uploaded. Opening a method does not disable other methods.
  Grade and birth-date provisioning, update cadence, supported attributes,
  dynamic groups, licensing and cross-method precedence require validation.
  Birth date is described as an Entra ID attribute, not an assumed SDS feed.
  Fixed illustrative counts do not implement unresolved conflict policies.
- **Apps & agents:** filter and toggle settings. Disabling Study and Learn also
  clears and disables pre-selection. A purple **New** badge marks the seven
  owner-selected new admin controls in both this page and guided setup:
  Study and Learn agent, Teach module, Class Insight Agent, Reading Progress,
  Search Coach, Speaker Progress and Math Progress. Badges identify new controls in this
  concept, not new apps or shipping availability; all other controls are unmarked.
- **Connectors & data:** agent connections appear first. Connect Canvas
  agent data, simulate connector consent and disconnects,
  and control OpenStax availability. SDS is a portal handoff only, without
  embedded sync/error reporting or roster-readiness checks. Review age-group
  counts in Student safety after roster changes. App toggles and agent connectors keep their
  immediate setting updates, independently of age-group counts.
- **Scope & dependencies:** open the planning dialog from the demo banner.
  Education top-level navigation is preferred for education tenants only,
  subject to MAC approval and targeting validation; a consolidated Org settings
  page is the fallback. The dialog separates core candidates, explorations,
  separately costed provisioning, deferred integrations and audience-control
  validation. No delivery dates or release commitments are implied.
- **Automatic count updates:** demonstrate the proposed automatic experience
  without manual refresh controls. Feasibility and timing, including refresh
  after roster changes, remain subject to engineering validation. Stale
  snapshots from earlier demo versions are reconciled with saved sample
  classifications on load. Unrelated app or connector changes do not advance
  the age-count timestamp.
- **Reset demo:** restore the original sample tenant for another walkthrough.

Applied settings and internal demo activity persist in this browser's local storage.
The former Recent changes feed is not shown; the audit action previews a handoff
and explicitly identifies unverified production coverage. Existing flat group
selections are migrated to multi-select arrays without clearing saved settings.
Guided setup drafts remain in the current tab until reloaded. If storage is
unavailable, the demo displays a warning and changes last only in the tab.
Classification results are fixed illustrations, not eligibility calculations.
Connector consent is simulated; there is no backend, authentication, telemetry,
real student information or live service integration. Custom endpoints are
validated locally and never contacted or stored. Google Fonts is the only
external asset request.

The existing light admin-center look is retained, with an optional dark theme.
The site is marked `noindex`; this is not access control. GitHub Pages and all
repository content are public.

## Run locally

Open `index.html` in a browser, or serve this folder with a static HTTP server.
No dependencies or build step are required.

GitHub Pages publishes the root of `main`. Only the static demo files belong in
this repository; do not add internal documents or workspace files.

## Sources / References

- Owner-provided **Education Admin Hub** North Star concept, October 2026.
  The internal source document is intentionally not included in this public repo.
- The existing Education Admin Hub prototype in this repository.
- Owner feedback, October 19, 2026: original delayed-count baseline, superseded
  for this concept demo by the October 22 automatic-update direction below.
- Owner-approved feedback-review updates, October 22, 2026: retain Student
  safety naming and standalone setup, show integration explorations, simplify
  readiness, support multiple classification methods, and prioritize agent
  connectors over embedded SDS reporting.
- Owner correction, October 22, 2026: remove manual count refresh across the
  demo, demonstrate automatic updates after saved classification changes, keep
  drafts isolated, and label the behavior as proposed pending validation.
- Owner-provided admin-center navigation screenshot, October 22, 2026:
  integrate Education into the full Microsoft 365 menu, not a separate
  Education-only sidebar. The reference image is not included in this repo.
- Owner requirements, October 22, 2026: curriculum grounding for Teach module
  first, Study and Learn later; an enable control and a list of SharePoint
  site URLs, retained when disabled.
