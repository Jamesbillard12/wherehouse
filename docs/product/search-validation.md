# MVP Phase 2 search validation

WhereHouse connected search is authoritative on the API. `SearchItems` normalizes leading,
trailing, and repeated query whitespace, compares case-insensitively, excludes archived items, and
limits responses to 50 results. An empty or whitespace-only query returns no search results rather
than scanning inventory. Input is capped at 200 characters and SQL wildcard characters are escaped
and treated literally.

Searchable item fields are name (exact, prefix, or partial), manufacturer, model, human-readable item
code, serial number, and the current direct area, zone, container name, or container code. Containers
are also first-class results, searchable by name, code, description, direct area, and zone. Both
result types are ordered by exact name, name prefix, name substring, other metadata, then
case-insensitive name and stable ID. Physical-identifier public IDs are intentionally excluded:
scanning and explicit identifier resolution own that lifecycle.

Every result contains the item projection and its current canonical resolved path. The path is
calculated through the same bounded-query resolver used by item-placement lists, so hierarchy edits
and moves are reflected on the next search/refetch without client breadcrumb reconstruction.

Mobile uses the server search while connected. Until that response arrives—or when the server is
unavailable—it searches the current household's SQLite-backed cached item fields (name, code,
manufacturer, and model) and cached resolved placement. This fallback can be stale and cannot match
location names not present in its cached placement data; reconnect/realtime reconciliation replaces
it with canonical results. Search state resets when the paired household changes.

## Manual validation dataset

Create `Garage > North Wall > Shelf > Yellow Bin` and at least one other nested location. Add:

- Camping Stove, manufacturer `Coleman`, model `Classic 2-Burner`
- Coleman Lantern
- Sleeping Bag
- Socket Set
- Extension Cord

For a performance sanity run, duplicate varied versions of these records and locations until the
household contains 1,000 active items. Record API timings (not a formal benchmark) for `Camping
Stove`, `camp`, `coleman`, an item code, `Yellow Bin`, a broad query, and a no-result query. Confirm
the response is capped, has no obvious pause on the supported Pi-class target, and does not issue a
per-result location request.

On web and mobile, verify full/partial name, manufacturer/model/code/direct-location matches; clear,
loading, no-result, and server-error states; opening a result; and the current resolved path. Then
rename the item, move the item, move or rename its container, and archive the item, searching after
each operation. Repeat mobile once while disconnected to validate the documented cached fallback,
then reconnect and verify canonical convergence. Record simulator/emulator and physical-device
evidence separately.
