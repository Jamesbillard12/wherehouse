# Physical identifier validation

Phase 3 separates implemented behavior from physical-device evidence. Automated tests and type
checks do not establish camera, NFC antenna/tag, OS, or printer compatibility.

## Implemented contract and safety behavior

- QR and NFC encode `wherehouse://identify/v1/<opaque-public-id>`; payloads contain no household,
  user, item/container name, database UUID, credential, or token.
- A QR identifier is active when created. An NFC identifier remains pending until the client writes
  its NDEF URI, reads it back in the same native session, verifies an exact match, and calls the
  activation capability.
- Registration, resolution, activation, and revocation enforce household membership in reusable
  application capabilities. Active targets must still exist, be unarchived, and belong to the
  identifier's recorded household.
- Activation and revocation are retry-safe. A revoked identifier cannot be reactivated or resolved.
  The database prevents more than one pending/active identifier for a target and medium and makes
  public identifiers unique.
- Mobile QR scanning accepts one frame per single-scan screen; multi-scan sessions debounce frames
  and suppress already-seen payloads. Malformed and unsupported-version payloads are rejected before
  identifier resolution. NFC reports unsupported and disabled device states separately when the
  native platform exposes them.

## Physical validation matrix

Record device model, OS version, build type, tag type, date, and observed result. A blank cell is not
a pass.

| Platform | QR scan | NFC read | NFC write | Read-back verify | Empty tag | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | Not run | Not run | Not run | Not run | Not run | Physical iPhone and development/release build required |
| Android | Not run | Not run | Not run | Not run | Not run | NFC-capable physical Android device and development/release build required |

For each platform exercise item and container targets plus active, revoked, unknown, malformed,
unsupported-version, and wrong-household payloads. Also cancel reads/writes, remove a tag during
verification, retry a failed write, deny camera access, and confirm repeated QR frames do not cause
duplicate navigation.

## Printed QR label check

Not run. Print representative item and container labels and record printer/paper, physical QR size,
text readability, contrast, margins/clipping, and repeated scans from each claimed mobile platform.
This is generic output validation, not certification for a printer model.

## Current limitations

- NFC requires a native iOS/Android build; it is not supported by Expo Go or a simulator/emulator.
- The application can identify an unsupported device and, where exposed by the native platform, an
  NFC-disabled device. OS-native cancellation and tag/read-only errors may still vary by platform
  and must be recorded from hardware.
- A failed or cancelled NFC write leaves the reusable identifier pending. Retrying registration
  returns that same pending identifier; the backend does not claim the tag is active until verified.
- No physical support claim is made until the corresponding matrix row is completed.
