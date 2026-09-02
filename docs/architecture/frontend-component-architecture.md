# Frontend component architecture

WhereHouse pages and screens compose features. They do not own a reusable interaction merely because
that interaction first appeared there.

## Dependency and ownership model

```text
page / application shell
        ↓
feature component, form, dialog, or controller
        ↓
shared WhereHouse component
        ↓
generic platform UI primitive
```

Web and mobile share API contracts and domain semantics through `@wherehouse/api-client`; they do not
share DOM/React Native rendering. A component belongs at the narrowest level that truthfully owns its
behavior. Feature code must not import another feature's private form or hook. Promote genuinely common
presentation to `components/wherehouse` (web) or `src/components` (mobile), and keep generic framework
primitives in `components/ui`.

## Pages, screens, and the application shell

Pages select and arrange features, translate route intent, and provide layout. They may hold local
selection state, but must not be the only place a reusable create, edit, details, label, search, pairing,
or confirmation interaction can run. Navigation is an explicit user outcome, never a technique for
mounting a dialog.

Application-wide interactions use a small typed feature-action context and a single feature host. The
context describes semantic requests (`createItem`, `createArea`, `createZone`, `createContainer`, and
`openItem`) rather than string events or arbitrary global state. Dialog form values and page-local UI
state remain local.

## Forms and dialogs

- Create and edit experiences reuse field groups whenever their data substantially overlaps. Controllers
  translate semantic values into API requests; fields do not decide routes or global modal state.
- Feature dialogs build on the platform's established dialog/modal foundation. Web dialogs use the Base
  UI-backed `Dialog`; destructive operations use `ConfirmDialog`. Mobile destructive operations use
  `ConfirmModal`.
- Generic image selection, preview, and cropping remain reusable presentation. Item/container upload calls
  stay with their features.
- Details, edit, archive, label, and image workflows may be composed within one host but remain separately
  testable responsibilities.

## State and controllers

Use local state for local interaction, a feature hook/controller for lifecycle and mutation state, and a
narrow context only for state/actions that genuinely cross the application tree. Services perform
external or persistence operations. Hooks coordinate React lifecycle, retries, subscriptions, loading,
and errors. Components render semantic data/actions.

Redux is not currently justified: the observed problems are ownership, duplication, and oversized
orchestrators rather than a need for one shared mutable state graph. Reconsider only if cross-feature
optimistic workflows become pervasive and reducer/devtools semantics would measurably reduce complexity.

## Location and identifier semantics

Prefer canonical `resolved_path` values returned by application capabilities. Client fallback traversal
must be cycle-safe and live in one platform utility, never be copied into unrelated renderers. QR/NFC
controls reuse shared semantic contract values while preserving platform-specific presentation and native
behavior.

## Testing convention

Test at the ownership boundary: focused form/component/hook tests, feature integration tests, then a small
number of application workflow tests. Feature-action tests must prove a global action opens in place and
does not change the current route. Keep accessibility names, focus restoration, Escape/backdrop behavior,
busy states, and destructive confirmation in coverage.

## Naming and examples

Use concrete names such as `CreateItemDialog`, `AreaFormFields`, `usePairingSession`, and
`GlobalFeatureHost`. Avoid generic mega-components such as `EntityModal`, boolean forests in root
components, page-owned reusable features, duplicated create/edit markup, ad-hoc dialog backdrops, and
string-based event buses.

These boundaries are compatible with a future controlled generative UI registry because actions are
semantic and typed. This work does not add that registry or allow generated runtime UI.

## Audit checklist and current decisions

The application-wide audit covered `apps/web/src`, `apps/mobile`, and `packages/api-client` using file-size,
state, form, modal, mutation, navigation, subscription, image, selector, and confirmation searches.

- **Fixed now:** quick-create no longer navigates to Items/Locations just to mount create UI; a typed action
  boundary and global host own the cross-tree workflow; the previous hidden `ItemsView` host was removed.
- **Existing good boundaries retained:** web Dialog/ConfirmDialog/image crop/create-image primitives;
  mobile ConfirmModal, QuantityStepper, ScannerScreen, ItemLocationPicker, LocationSelectorSheet; shared
  API identifier/realtime contracts.
- **Needs continued extraction:** `LocationsView`, `ItemsView` details/edit internals, Dashboard shell/search/
  menus/review/realtime, mobile `App.tsx`, mobile Add/Edit shared field sections, and web/mobile device
  pairing controllers. These are meaningful debt, not candidates for blind abstraction.
- **Intentionally not generalized:** entity upload operations, DOM/native rendering, navigation library,
  schema-driven forms, Redux, broker infrastructure, and future generative UI.

When completing later slices, preserve behavior and extract one coherent lifecycle at a time with focused
tests. A wholesale file move without responsibility changes does not satisfy this architecture.
