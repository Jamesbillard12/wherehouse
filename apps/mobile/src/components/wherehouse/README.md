# WhereHouse mobile components

This directory is for reusable product-aware presentation that composes primitives from `../ui`.
Components here may understand items, locations, physical identifiers, and sync states, but do not
own API calls, mutations, permissions, navigation, or feature orchestration.

Keep workflow state and external effects in `src/features`, screens, hooks, and services. Promote an
existing component into this directory only when it represents a genuinely shared product concept;
do not create thin aliases for generic primitives.
