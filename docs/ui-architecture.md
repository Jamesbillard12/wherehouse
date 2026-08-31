# UI component architecture

This document records the evaluated component strategy for the existing WhereHouse web and mobile
applications. It complements the product-level [UI direction](ui-direction.md) and the controlled
[generative UI architecture](generative-ui.md). Library choices below are presentation-layer
decisions, not shared application contracts.

## Current stack audit

| Concern | Web | Mobile |
| --- | --- | --- |
| Runtime | React 19, Vite 7, TypeScript | React Native 0.81, Expo 54, React 19, TypeScript |
| Components | Native HTML composed directly in feature components | React Native primitives plus `AppHeader`, `BottomNavigation`, `ScannerScreen`, `ItemLocationPicker`, and `QuantityStepper` |
| Styling | Global hand-written CSS split into base, dashboard, inventory, and responsive files | One large shared `StyleSheet` with a few inline icon colors |
| Tokens | A small set of CSS custom properties for colors and button dimensions; many literal values remain | No token module; colors, spacing, type, radii, and elevation are literal values in the shared stylesheet |
| Icons | `lucide-react` | `lucide-react-native` |
| Forms | Native HTML forms and local React state; no form library | `TextInput`, `Pressable`, local state, and focused draft/edit hooks; no form library |
| Component library | None | None |
| Tailwind | Not installed or configured | Not installed; NativeWind is not installed |

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
components semantically, and establish token mappings alongside the first incremental shadcn/mobile
foundation work. The first web adoption should be a bounded feature or dialog with accessibility and
visual-regression checks. The first mobile step is the prototype described above.

Deferred: Tailwind/shadcn installation, full web migration, gluestack installation or full mobile
migration, a shared token package, generative UI schema/renderer/runtime registry, 3D or AR
implementation, cross-platform component abstraction, and a large design-system rebuild.
