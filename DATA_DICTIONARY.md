# Data dictionary — glucose CSV export

Describes every column in `hba1c-tracker-glucose-*.csv` (Settings → Export
glucose readings). This is the glucose-readings export only; the full JSON
backup (Settings → Export all data) includes every other table (meals,
exercise, sleep, protocol runs, lab A1c history, etc.) losslessly and is
the file to use for restoring the app via Settings → Restore from backup.

The original 5 columns (`timestamp`, `value_mgdl`, `context`, `source`,
`note`) are unchanged from the first version of this export. Everything
else is additive — a file from before this upgrade is still a valid
(partial) input anywhere a CSV with those 5 columns is expected.

| Column | Type | Meaning |
|---|---|---|
| `measurement_id` | integer | The reading's local database id. Stable within this device's data, not a universal identifier. |
| `timestamp` | ISO 8601, UTC | The canonical instant the reading was taken. Always present. |
| `timestamp_local` | ISO 8601, no timezone suffix | The reading's wall-clock local time, reconstructed from `timestamp` + `timezone_offset_minutes` at the time it was logged. Blank when no offset was captured (e.g. older rows, CSV-imported rows). |
| `timezone_offset_minutes` | integer | Minutes EAST of UTC, captured once at entry time (e.g. `-300` for US Eastern during EST). Not recomputed later, so it reflects where the reading was actually taken even if analyzed from a different timezone later. Blank when unknown. |
| `value_mgdl` | number | Glucose value in mg/dL. |
| `context` | enum | One of: `fasting`, `pre_meal`, `post_meal_1h`, `post_meal_2h`, `post_meal` (timing not asserted), `waking`, `bedtime`, `overnight`, `exercise`, `random`, `symptom_driven`. A label of USER INTENT, not a guarantee of actual elapsed time — see `meal_id`/`target_post_meal_minutes` below. |
| `source` | enum | `manual` or `csv_import`. |
| `device_id` | string | Free-text meter/app name, if entered. Blank if unknown. |
| `meal_id` | integer | Links this reading to a row in the meals table for actual-elapsed-time analysis. Blank if not linked — the app never guesses this link from proximity alone. |
| `target_post_meal_minutes` | integer | The timing the user INTENDED (e.g. 60 for "meant to be the 1hr check"). Analysis uses the actual elapsed time between this reading's timestamp and the linked meal's timestamp, never this field — the two can diverge significantly. |
| `protocol_run_id` | integer | Links this reading to a structured collection run (Awakening Glucose Profile or Meal Glucose Response). Blank if not part of a run. |
| `protocol_role` | string | This reading's role within that run, e.g. `T0`/`T30`/`T60` or `pre`/`30min`/`60min`/`90min`/`120min`. |
| `caffeine_before_measurement` | boolean | Optional quick-entry context. |
| `alcohol_previous_24h` | boolean | Optional quick-entry context. |
| `stress_level_1_5` | integer 1-5 | Optional, self-reported. |
| `illness_flag` | boolean | Optional quick-entry context. |
| `medications_taken` | string | Optional free text. |
| `supplements_taken` | string | Optional free text. |
| `hydration_status` | enum | `low` / `normal` / `high`, optional. |
| `symptoms` | string | Optional free text. |
| `note` | string | Free-text note, unchanged from the original export. |

## Re-importing this file

The app's CSV importer (Diet & log pages → "Import from Contour CSV") maps
columns by name, not position, so it can read this export's `timestamp`
and `value_mgdl` columns the same way it reads any third-party meter
export. It only pulls in the 5 basic fields (timestamp, value, context,
note) — it does not reconstruct meal/protocol links or the optional
context fields, since those require the app's own record ids to resolve
correctly. For a full-fidelity round trip, use the JSON backup instead
(Settings → Export all data / Restore from backup).
