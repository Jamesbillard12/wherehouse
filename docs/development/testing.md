# Testing

Run the narrowest relevant tests while iterating, then backend tests/Ruff and client tests/type checks
for affected packages. Business rules belong in application/domain tests; routes and components test
adapter behavior; critical workflows need integration and physical-device evidence.

For MVP validation, use the [release checklist](../product/mvp-release-checklist.md). A compiling
component or existing endpoint is not evidence of end-to-end, physical, or release validation.
