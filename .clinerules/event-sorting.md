## Brief overview
This rule ensures that all events in the Salesforce Community Events README file are properly sorted by date in ascending order (earliest to latest) to maintain consistency and improve user experience.

## Event table organization
  - Always sort events in the Events Overview Table by Date column in ascending order (earliest to latest)
  - Only future events (relative to today's date) with known dates should appear at the top of the table
  - Events should be listed chronologically from January through December for each year
  - Multi-day events should be sorted by their start date
  - When adding new events, insert them in the correct chronological position
  - TBD-dated events should always appear at the bottom of the table

## Date format consistency
  - Use consistent date format: "Month Day, Year" (e.g., "January 30, 2026")
  - For multi-day events, use range format: "Month Day-Day, Year" (e.g., "March 25-27, 2026")
  - Ensure all dates are properly formatted and consistent throughout the table

## Year grouping
  - Group events by year (2026, 2027) while maintaining chronological order within each year
  - 2026 events should appear before 2027 events
  - Within each year, events should be sorted chronologically

## How the script curates data (read before hand-editing the README)
  - Events come from two sources: the Salesforce community API (fetched live) and the hard-coded `MANUAL_EVENTS` array in `check-cfp-status.js`.
  - **The Events Overview Table is fully regenerated on every run.** Any manual edit made directly to README.md is overwritten the next time the script runs. To make a fix stick, encode it in the script, not the README:
    - **Wrong/missing link or date** → add an entry to the `EVENT_OVERRIDES` map (keyed by exact event name). Override values are preserved even when a site fetch fails, so they don't collapse to TBD.
    - **CFP deadline** → the script AUTO-extracts deadlines from the event homepage and its CFP page (first month-name date within ~120 chars after a deadline-ish keyword; abbreviated months expand; a candidate equal to the event's own date is ignored; the CFP page outranks the homepage). Add a `cfpDeadline: "November 15, 2026"` override to pin a deadline the sites don't state or state wrongly (pins always win) — it renders in the CFP Status cell as `— deadline <date>` after the OPEN link. For a CFP that already closed, set a raw `cfpStatus` cell string instead (e.g. `"Closed — deadline August 24, 2026"`) — display-key overrides are re-applied after the site scan so the computed [OPEN]/TBD value can't clobber them. Expect roughly half of sites to publish nothing (sampled 2026-11-05: found 2 of 5).
    - **Event missing from the API feed** → add it to `MANUAL_EVENTS` (the API feed is intermittent — e.g. Forcelandia has been dropped and re-added by the feed).
  - Past-dated events are automatically rolled forward to a next-year TBD placeholder (e.g. "MC² 2026" → "MC² 2027"). When an event rolls, its `EVENT_OVERRIDES` entry must use the **new** (rolled) name/year to keep its links.
  - The **event count in the README header** (`**N Salesforce community events**`) is NOT written by the script — update it manually after a run if the row count changed.

## Post-script automation requirements
  After running `node check-cfp-status.js`, ALWAYS perform the following verification steps:

  1. **Verify sort order**: Confirm the Events Overview Table in README.md is sorted ascending (earliest date first).
     - Check that the first event in the table has the earliest upcoming date
     - Check that the last dated event has the latest date
     - Confirm TBD events appear at the bottom

  2. **Verify future-only events at top**: Confirm no past events (before today's date) appear in the main dated section of the table.

  3. **Verify date format consistency**: Scan the table for any dates not following "Month Day, Year" or "Month Day-Day, Year" format and fix them.

  4. **Re-sort if needed**: If the table is out of order after the script runs, manually re-sort the README.md table rows to restore ascending chronological order.

  5. **Verify per-event .ics downloads are in sync**: the script writes `ics/<event-slug>.ics` for every dated table row and an "Add 📅" cell in the Calendar column (TBD-dated rows get no file). Compare the .ics count against dated rows; the script also removes stale slugs from rolled/renamed events. Files are byte-stable across runs (DTSTAMP is pinned to the event's own start), so a clean run leaves `git status` quiet. Do not hand-edit .ics files — they regenerate every run. Links use the GitHub blob URL (`.../blob/main/ics/<slug>.ics`) because raw.githubusercontent serves `.ics` as `text/plain` and most browsers would display it instead of offering a download; the blob page has a "Download raw file" button.

  6. **Check the script's cross-reference output**: the run ends with a "Potential new events found" list. Investigate each — it usually means an event the API dropped (add to `MANUAL_EVENTS`) or a genuinely new event to add. One source is the **official Trailblazer Community conferences page** (fetched through the r.jina.ai JS reader — one call per run; rapid-fire r.jina.ai calls rate-limit to empty responses).

  7. **Watch for dropped or duplicate events**: compare the row count before/after the run. A sudden drop usually means the API stopped returning an event (pin it in `MANUAL_EVENTS`). Duplicate rows for the same event/year should be deduped.

  8. **Sanity-check links for false positives/negatives**:
     - A "Buy Tickets" link pointing at a sponsor/speaker registration URL is wrong (should be TBD).
     - An override-backed event that suddenly shows TBD links means a fetch failed and the override didn't apply — confirm the `EVENT_OVERRIDES` key matches the current (possibly rolled-forward) event name.

  8. **Update the manual event count** in the README header to match the actual number of table rows (the script does not maintain this number).

## Maintenance requirements
  - When updating the README with new events or date changes, always re-sort the entire table
  - Verify chronological order after any modifications to event dates
  - Use date sorting as a validation step before finalizing README updates
  - Run the post-script verification steps every time `check-cfp-status.js` is executed
