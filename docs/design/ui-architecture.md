# UI component architecture

This document records the evaluated component strategy for the existing WhereHouse web and mobile
applications. It complements the product-level [UI direction](ui-direction.md) and the controlled
[generative UI architecture](../architecture/generative-ui.md). Library choices below are presentation-layer
decisions, not shared application contracts.

## Current stack audit

| Concern | Web | Mobile |
| --- | --- | --- |
| Runtime | React 19, Vite 7, TypeScript | React Native 0.81, Expo 54, React 19, TypeScript |
| Components | Native HTML plus an incremental shadcn/Base UI primitive layer | React Native primitives plus `AppHeader`, `BottomNavigation`, `ScannerScreen`, `ItemLocationPicker`, and `QuantityStepper` |
| Styling | Tailwind CSS v4 for new primitives alongside global hand-written CSS split into base, dashboard, inventory, and responsive files | One large shared `StyleSheet` with a few inline icon colors |
| Tokens | A small set of CSS custom properties for colors and button dimensions; many literal values remain | No token module; colors, spacing, type, radii, and elevation are literal values in the shared stylesheet |
| Icons | `lucide-react` | `lucide-react-native` |
| Forms | Native HTML forms and local React state; no form library | `TextInput`, `Pressable`, local state, and focused draft/edit hooks; no form library |
| Component library | shadcn Nova source components backed by Base UI; first pilot is the add-item dialog | None |
| Tailwind | Tailwind CSS v4 through the Vite plugin | Not installed; NativeWind is not installed |

The clients share API types and inventory concepts, not UI implementations. Duplication is mostly
visual constants and repeated concepts—cards, buttons, inputs, item/location rows, status colors,
and location paths. This is healthy platform separation, but literal values have drifted: web and
mobile use several different navy, green, border, surface, and text values; interactive controls
are implemented repeatedly; and some web dialogs are bespoke ARIA markup while mobile accessibility
labels are applied inconsistently. The mobile stylesheet has also become a broad, screen-spanning
module. These are reasons to introduce tokens and primitives gradually, not to share JSX.

## Decision summary

```text
WhereHouse design tokens      Versioned semantic UI contracts
          |                                |
    platform mapping                 platform registry
      /          \                    /          \
web CSS/Tailwind  mobile theme       web          mobile
      |              |                |              |
shadcn/Base UI   RN/gluestack     semantic components and screens
```

- Use shadcn/ui as the preferred source for **new low-level web components**, styled with Tailwind.
  Use the shadcn-supported Base UI implementation by default for newly added primitives; pin the
  choice in `components.json` when initialization occurs.
- Keep existing CSS-based screens working. Adoption is progressive and feature-driven, not a full
  migration. Existing Vite/React/Lucide choices fit shadcn well, but setup still requires Tailwind,
  an import alias, theme mapping, and component dependencies.
- Keep mobile independently optimized around React Native. `gluestack-ui` is the leading candidate,
  subject to a small Expo prototype and dependency/accessibility review before adoption.
- Share WhereHouse-owned design tokens and semantic contracts. Do not share library APIs or force a
  universal component implementation.

## Web primitives

Place shadcn-managed or equivalent low-level web components under
`apps/web/src/components/ui`. Suitable additions include Button, Input, Select, Dialog, Sheet,
Dropdown, Tooltip, Tabs, Accordion, Table, form controls, and command/search UI. This directory is a
web implementation detail and may expose shadcn/Base UI composition APIs only to web presentation
code.

Place product concepts under `apps/web/src/components/wherehouse` as they become reusable. For
example, `ItemCard`, `LocationCard`, `ItemDetails`, and `MoveItemDialog` compose primitives but expose
WhereHouse data and behavior. Features should not add a wrapper that merely renames every primitive;
the semantic layer is warranted when it captures a product concept, behavior, or stable contract.

shadcn is a good fit because it supports Vite, leaves component source in the repository, works with
the already-selected Lucide icon family, and permits incremental ownership. Tailwind is therefore a
new web implementation dependency, not a shared styling contract. Existing selectors may coexist
while touched features move toward tokens and primitives. Adopting shadcn does **not** require a
major one-time migration, and no current screen should be converted solely for consistency.

### Installed web primitive baseline

The first bounded adoption uses the shadcn `base-nova` style, Base UI, Lucide, CSS variables, and
Tailwind CSS v4. Configuration lives in `apps/web/components.json`; generated and subsequently owned
source lives in `apps/web/src/components/ui`. The installed primitive set is AlertDialog, Button, Dialog, Input,
Select, and Textarea. Button owns product-neutral variants (`default`, `outline`, `secondary`, `ghost`,
`destructive`, and `link`), sizes (text and icon sizes from `xs` through `lg`), disabled mechanics,
focus-visible styling, and the shared `pending` state. Pending buttons are disabled, expose
`aria-busy`, and include a non-semantic spinner while callers retain control of the visible action
label. Input and Textarea own disabled, invalid, and focus-visible styling. AlertDialog, Dialog, and Select own
their keyboard and focus behavior through Base UI.

Use Dialog for ordinary modal workflows and richer product workflows. Use AlertDialog for a
destructive or consequential decision that must interrupt the user before work starts; unlike Dialog,
it does not dismiss from an outside press. Both primitives own the shared overlay, responsive content,
title/description, focus containment/restoration, Escape handling, and keyboard behavior. While a
mutation is pending, disable dismissal and every action that could submit or abandon it, keep the
pending label visible, and render mutation errors inside the open dialog.

`ConfirmDialog` is the shared WhereHouse confirmation behavior, not a primitive alias: it composes
AlertDialog with consistent cancel/confirm placement, destructive intent, pending-state dismissal and
duplicate-submit guards, and an in-dialog error region. Callers remain responsible for specific titles,
consequences, mutations, and product state. Do not add browser-native confirmation APIs or bespoke
backdrops/focus handlers. A typed destructive phrase may remain a custom blocking workflow when the
extra friction is itself a safety requirement.

### Dialog and confirmation inventory

The dialog-standardization audit classified the web application as follows:

| Classification | Workflows | Standard |
| --- | --- | --- |
| Ordinary interaction | quick/add item, location create/edit, nested item create, item details/edit, QR label | Dialog |
| Destructive confirmation | item archive, area/container delete, device revoke | ConfirmDialog over AlertDialog |
| Consequential confirmation | Dropbox disconnect, network-storage disable, application update install | ConfirmDialog over AlertDialog |
| Rich custom workflow | image crop, companion-capture review queue | Dialog with workflow-specific content |
| Blocking decision | prepare and migrate an external storage device | Typed phrase retained because disk erasure requires deliberate host-boundary confirmation |

No direct `window.confirm`, `window.alert`, or `window.prompt` calls remain in the web application.

WhereHouse colors are mapped to shadcn's semantic variables in `apps/web/src/styles.css`, while
existing screen CSS remains active. Ordinary text, email, password, number, and readonly form fields
use Input; multiline text uses Textarea. Native controls remain appropriate where they provide a
distinct browser interaction that has not yet been migrated and tested, including file, range,
radio, and checkbox inputs. Existing native selects remain intentional when replacing them with the
composed Select would change form submission or keyboard behavior.

The add-item dialog was the pilot consumer. It validates focus containment and restoration, Escape
and backdrop dismissal, form submission, and disabled saving behavior. Other bespoke dialogs remain
unchanged until their features are touched. Native `select` is intentionally retained in the pilot;
adopt the shadcn Select only when a feature needs its richer composition and the interaction change
can be tested directly.

### Usage and extension rules

Before writing a native control or a new utility-class bundle, search both `components/ui` and
`components/wherehouse`. Use a component from `components/ui` when the concern is product-neutral
presentation or interaction mechanics. Extend an installed primitive only when a real caller needs a
reusable, product-neutral variant, size, state, or accessibility behavior; keep the existing
`data-slot` contract and add direct primitive tests when behavior changes.

Create a component in `components/wherehouse` when it names a product concept or centralizes reusable
WhereHouse behavior, copy, domain-shaped props, or action semantics. Such a component should compose
primitives and expose a stable product-facing API. Do not add a thin wrapper whose only purpose is to
rename Button, Input, Dialog, Card, Badge, or another shadcn primitive.

Add a missing shadcn primitive only for current or immediately scheduled feature work. The audit for
the primitive-foundation refactor did not justify preinstalling Card, Badge, Label, Checkbox,
Separator, Tooltip, Dropdown Menu, or Popover: current card and badge markup carries feature-specific
layout or status semantics, and the remaining native control/menu patterns require focused interaction
tests during their owning refactors. Dialog migrations, shared status views, location navigation,
physical identifiers, item UI, Settings, and the app shell should add or adopt those primitives only
as each real consumer is refactored.

### Shared state presentations

Reusable loading, empty, error, and inline status presentation lives in the WhereHouse component
layer. `LoadingState` is for section-level waits where the existing view does not use a deliberate
skeleton or progress indicator. `EmptyState` provides the shared icon, heading, description, and
optional action layout. `ErrorState` provides the corresponding prominent failure and retry layout.
`StatusMessage` is for compact informational, success, warning, or error feedback within an active
workflow. Error tones use alert semantics; other tones use status semantics, so callers should not
add live regions unless dynamic announcement is useful for that interaction.

Features continue to own all domain copy, retry callbacks, mutations, availability decisions, and
action labels. Pass actions into the state component rather than embedding API behavior there. Do
not replace intentional search-menu feedback, skeletons, progress bars, realtime indicators, form
validation, or dense health/status cards with a generic state display when their interaction or
information hierarchy is meaningfully different. Future screens should search the WhereHouse state
components before duplicating icon/title/body/action markup, and add a new variant only when current
callers demonstrate a distinct reusable presentation.

### Shared location presentation and selection

`LocationPath` owns the common accessible presentation of resolved area, zone, and nested-container
paths. It accepts resolved segments, performs no fetching, and supports the two established web
presentations: compact text and the navigable container breadcrumb. `locationPaths.ts` centralizes
cycle-safe display derivation for contracts that do not already provide a canonical `resolved_path`;
server-resolved paths remain authoritative when available.

`LocationSelector` owns the item-placement destination list and its label, optional/required
placeholder, disabled state, and associated validation feedback. Callers still own selected state,
mutation behavior, and all authorization or destination-validity decisions. Container parent
selection remains in the Locations feature because its same-zone, self/descendant, relationship,
and cycle semantics differ from item placement. Area and zone selectors used to establish another
location's scope likewise remain feature-specific. Future location-aware workflows should reuse
these components and helpers before adding path markup or an equivalent placement selector.

### Shared physical identifier presentation

`PhysicalIdentifierPicker` owns the accessible QR, NFC, combined, and unassigned selection group,
including its established labels, explanatory copy, disabled state, and validation presentation.
Item and container create/edit workflows pass initial state and continue to own form submission,
permissions, mutations, and success or failure handling. `PhysicalIdentifierSummary` provides the
shared icon-and-text representation for compact item and container status displays.

QR generation, registration, replacement, revocation, printing decisions, and NFC behavior remain
feature-owned. The existing item and container label adapters perform their own API calls and pass
resolved QR image state to `PhysicalLabelDialog`; the shared presentation components do not embed
identifier lifecycle rules. Future identifier-aware web workflows should search these WhereHouse
components before adding selection, summary, or label markup.

## Mobile foundation evaluation

| Option | Fit | Trade-off |
| --- | --- | --- |
| React Native primitives (current) | Strong native control, smallest dependency footprint, already working | More accessibility/theming discipline and repeated component work remain WhereHouse's responsibility |
| gluestack-ui | Leading candidate: native-focused components, theming, accessible primitive intent, and incremental use | Adds dependencies and another styling/theming layer; Expo compatibility, bundle impact, and real assistive-technology behavior need a prototype |
| Tamagui | Strong tokens, themes, performance tooling, and cross-platform reach | More build/tooling complexity and encourages a broader web/mobile abstraction than WhereHouse currently needs |
| React Native Paper | Mature accessible components and theming | Material design defaults are a less direct fit for the current WhereHouse visual language |
| NativeWind-based components | Familiar utility workflow and flexible ownership | Utilities alone do not supply accessible behavior; coupling both clients to similar class syntax provides little product-level reuse |

Continue using native primitives for current screens. Before selecting gluestack, prototype one
representative flow containing input, validation, modal/sheet behavior, keyboard handling, dynamic
type, screen-reader labels, dark/high-contrast theming, and Android/iOS interaction. Adopt it only if
that prototype improves maintainability without regressing native ergonomics. If adopted, place
mobile primitives under `apps/mobile/src/components/ui` and semantic components under
`apps/mobile/src/components/wherehouse`; migrate only when a feature is touched.

## Shared design tokens

The canonical token vocabulary is platform-neutral and WhereHouse-owned. It should cover:

- semantic colors: background, surface, text, muted text, border, focus, brand/action, destructive,
  warning, success, and offline/pending/conflict states;
- spacing, typography scale and roles, radii, elevation intent, motion duration/easing, density, and
  meaningful responsive breakpoints;
- inventory semantics such as available, checked out, unplaced, pending sync, conflict, capacity
  warning, and stale/low-confidence spatial data.

Token names describe purpose (`color.status.pending`) rather than a literal (`indigo-500`) or a
Tailwind class. Web maps them to CSS variables and Tailwind theme values; mobile maps them to typed
theme objects consumed by React Native or the selected foundation. Platform mappings may differ for
elevation, motion, density, and breakpoints while retaining semantic intent.

Create `packages/design-tokens` only when both clients are ready to consume a versioned token source.
Until then, consolidate names and values within each client as touched and use this vocabulary to
prevent further drift. A package with no consumers would add false structure today.

## Primitive and semantic components

Primitive UI (`Button`, `Input`, `Dialog`, `Card`, `Badge`, `Select`) handles platform mechanics.
Semantic WhereHouse UI (`ItemCard`, `LocationCard`, `ContainerCard`, `ItemSearchResults`,
`LocationBreadcrumb`, `AddItemForm`, `MoveItemForm`, `ItemLocator`, `InventorySummary`,
`StorageRecommendation`, `SpatialView`, `LocationExplorer`, `QRScannerResult`) represents product
concepts. Semantic props use stable IDs, shared value types, display intent, and approved actions—not
Tailwind classes, shadcn slots, gluestack props, or renderer objects.

Future generative UI references only the versioned semantic component registry. Each registry entry
declares its schema/version, supported platforms, canonical data needs, permission requirements,
accessible behavior, approved actions, and fallback. Client renderers map it to authored web or
mobile components. Actions route through the same validated, actor-aware application capabilities as
traditional UI, including confirmation for consequential writes. Unknown components and unsupported
schema versions fall back safely; they never trigger arbitrary imports or runtime-generated code.

`SpatialView` follows the same rule. Its contract carries WhereHouse IDs and display intent. Web may
eventually render it with Three.js or React Three Fiber, while mobile may use native AR/spatial APIs.
The schema does not know which technology is underneath, and an accessible logical location view is
always available.

## Repository guidance

The current feature-oriented layout is small and should remain. Add these directories only with
their first real component:

```text
apps/web/src/components/ui/             web primitives
apps/web/src/components/wherehouse/     reusable product concepts
apps/mobile/src/components/ui/          mobile primitives, after selection
apps/mobile/src/components/wherehouse/  reusable product concepts
packages/design-tokens/                 once both clients consume it
packages/ui-schema/                     once a generative UI consumer is scheduled
```

`packages/api-client` remains for transport contracts and must not become a UI package. A separate
`shared-types` package is not justified until non-transport types have at least two consumers.

## Now and deferred

Now: use this decision for new work, keep Lucide as the common icon family, name new reusable product
components semantically, and extend the installed web primitives only for scheduled feature work.
Migrate existing dialogs incrementally with interaction and visual checks. The first mobile step is
the prototype described above.

Deferred: full web migration, gluestack installation or full mobile migration, a shared token
package, generative UI schema/renderer/runtime registry, 3D or AR implementation, cross-platform
component abstraction, and a large design-system rebuild.
