# ADR-0007: UI component and generative UI boundary

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

WhereHouse currently uses React with hand-written CSS on web and React Native primitives with a
shared `StyleSheet` on mobile. Both use Lucide. There is no component or form library, Tailwind is not
installed, the existing screens work, and visual constants have begun to drift. Future generative
and spatial UI need portable product semantics without forcing identical web and mobile rendering.

## Decision

Use shadcn/ui as the preferred source of new web primitives, with Tailwind and shadcn's currently
supported Base UI foundation. Adopt it incrementally and keep working CSS screens intact.

Keep mobile independently native. Continue with React Native primitives now and evaluate
gluestack-ui as the leading component-foundation candidate through a bounded Expo prototype before
adoption. Do not select a cross-platform system merely to maximize JSX reuse.

Define shared visual language as WhereHouse-owned semantic design tokens, mapped separately by each
platform. Product-level components form a semantic layer above primitives. Generative UI references
only a versioned registry of those semantic components and approved capability actions. `SpatialView`
uses the same boundary, with platform-specific 3D/AR implementations and an accessible fallback.

## Rationale

shadcn fits the existing Vite, React, TypeScript, and Lucide web stack, provides owned source rather
than an opaque package surface, and can be introduced one primitive at a time. Base UI is the current
shadcn default for new projects. Tailwind remains an implementation tool behind semantic tokens.

Mobile input, navigation, keyboard, camera, accessibility, and spatial interactions differ from web.
Independent implementations preserve those ergonomics. gluestack is promising for theming and
native-focused primitives, but adding it without testing would create migration risk without current
user value. Shared tokens preserve identity while semantic components preserve product behavior.

The generative boundary prevents model output from coupling schemas to shadcn, gluestack, Tailwind,
Three.js, or native AR APIs. It also keeps authorization, confirmation, accessibility, versioning,
unsupported-component fallbacks, and application capability invocation enforceable by authored code.

## Alternatives considered

- Keep only bespoke web CSS and native primitives: minimal dependencies, but repeated interactive
  behavior and accessibility work will continue to grow.
- Share one cross-platform component implementation: promises reuse but compromises native mobile
  ergonomics and creates unnecessary coupling.
- Tamagui: capable cross-platform tokens and tooling, but broader abstraction and build complexity
  than the current applications require.
- React Native Paper: mature and accessible, but its Material defaults are less aligned with the
  WhereHouse visual direction.
- NativeWind-based components: useful styling ergonomics, but not by itself an accessible component
  foundation and not a meaningful shared product contract.
- Expose primitive libraries to generative UI: rejected because it couples schema evolution to
  renderer details and expands the unsafe runtime surface.

## Consequences

Web and mobile may render the same concept differently. Some presentation code is intentionally
duplicated. Tokens and semantic contracts require governance, mapping, accessibility tests, and
version compatibility. Incremental adoption means old and new web styling may coexist temporarily.
In return, library replacement, native optimization, controlled generation, and future spatial
renderers remain possible without changing application or schema semantics.

## Now

Apply the detailed [UI component architecture](../ui-architecture.md) to new work. Retain Lucide,
introduce semantic names, and add platform primitive/semantic directories only with their first real
component. Validate shadcn on one bounded web feature and gluestack on one representative mobile
prototype before wider adoption.

## Deferred

Full web/mobile migration, installed component foundations, shared token and UI-schema packages,
runtime registries/renderers, cross-platform component implementations, and 3D/AR components remain
deferred until scheduled consumers justify them.
