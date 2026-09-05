# Mobile UI primitives

This directory contains low-level, product-neutral React Native primitives copied or adapted from
React Native Reusables. The files are source-owned by WhereHouse: product needs may justify changing
them, while upstream changes must be reviewed and adopted intentionally rather than overwritten by a
blind generator run.

Keep native accessibility and interaction behavior here, including roles, disabled state, touch
targets, pressed/focus feedback, and dynamic type support. Prefer extending an existing primitive
when a real caller needs reusable behavior. Do not add WhereHouse domain concepts, API calls, feature
state, or thin aliases that only rename another primitive.
