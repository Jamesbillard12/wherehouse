# Mobile UI migration inventory

This inventory records the migration path from `apps/mobile/src/theme/styles.ts` to the source-owned
React Native Reusables foundation. It is a roadmap, not authorization for a wholesale screen rewrite.
Migrate a coherent feature slice only when its behavior can be preserved and tested.

## Foundation installed

WhereHouse uses React Native Reusables as a source model with stable NativeWind 4 and Tailwind CSS 3.
Expo 54-compatible Reanimated and Worklets versions are pinned explicitly; Expo, React Native, camera,
NFC, secure storage, SQLite, image-picker, and safe-area dependencies were not upgraded. The initial
semantic tokens cover background/surface, text hierarchy, borders/input/focus, primary/secondary,
destructive, success, warning, spacing/touch size, and radii. Existing `StyleSheet` screens coexist
with the foundation during incremental migration.

The first proof is `PairingScreen`, using source-owned Button, Text, Input, and Card primitives. It
preserves the pairing callbacks and scanner entry point and adds explicit accessible labels, disabled
state, a 44-point minimum target, dynamic-type support, focus/pressed feedback, and an announced error.

## Migration map

| Area | Current inventory | Suggested owning slice |
| --- | --- | --- |
| Generic primitives | `card`, `button`, `scanButton`, `refreshButton`, `input`, `secondaryInput`, `saveButton`, icon buttons | Extend installed primitives only as real callers migrate |
| Cards and surfaces | dashboard card, location panel/group, item panel, photo/quick-fields panels, settings cards/lists, confirmation card | Migrate per feature; add a WhereHouse component only when product semantics repeat |
| Text and inputs | headings, eyebrow, descriptions, labels, metadata, errors, item/search/settings inputs | Use Text/Input variants; keep multiline, search, and item-field behavior feature-owned |
| Rows and lists | action tiles, container/content/item rows, settings rows, device rows, selector rows | Establish one product-aware row only after compatible usages are migrated |
| Modals and sheets | `ConfirmModal`, quick-action sheet, `LocationSelectorSheet` | Standardize confirmation separately; retain sheet navigation and dismissal behavior |
| Loading/status states | root activity, sync pill, empty inventory/location, save success, backup/device state, inline errors | Add reusable WhereHouse presentation without moving refresh or mutation logic |
| Location UI | location summary/groups, picker, chips/search results, hierarchy selector | Keep selection state and cycle-safe/canonical path behavior in location features |
| Scanner/identifiers | scanner overlay/finder, scan sessions, QR/NFC choices and actions | Migrate only with physical iOS/Android regression coverage |
| Item forms/details/media | add/edit headers, photo field, quick/optional fields, quantity, location, footer, success | Extract shared Add/Edit fields first; preserve image and offline queue behavior |
| Screen shell/navigation | safe area, content scroll, header, bottom navigation, quick actions | Coordinate with `App.tsx` extraction; preserve safe areas and deep links |

## Remaining validation

Automated type checking, unit tests, Expo configuration inspection, and platform export/compile checks
can validate the JavaScript pipeline. Physical iOS and Android runs remain required for keyboard,
screen-reader, dynamic type, pairing QR, camera, NFC, image picking, secure storage, SQLite, offline,
realtime, and revocation evidence. Do not claim those physical checks from simulator or static builds.
