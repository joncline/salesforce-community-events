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

## Post-script automation requirements
  After running `node check-cfp-status.js`, ALWAYS perform the following verification steps:

  1. **Verify sort order**: Confirm the Events Overview Table in README.md is sorted ascending (earliest date first).
     - Check that the first event in the table has the earliest upcoming date
     - Check that the last dated event has the latest date
     - Confirm TBD events appear at the bottom

  2. **Verify future-only events at top**: Confirm no past events (before today's date) appear in the main dated section of the table.

  3. **Verify date format consistency**: Scan the table for any dates not following "Month Day, Year" or "Month Day-Day, Year" format and fix them.

  4. **Re-sort if needed**: If the table is out of order after the script runs, manually re-sort the README.md table rows to restore ascending chronological order.

  5. **Verify .ics file is in sync**: Check that `salesforce_dreamin_events_2026.ics` contains a VEVENT entry for every event listed in the README Events Overview Table.
     - Compare event names/dates in the README table against SUMMARY/DTSTART fields in the .ics file
     - For any README event missing from the .ics, add a new VEVENT block with correct UID, SUMMARY, DTSTART, DTEND, LOCATION, and DESCRIPTION fields
     - Use UID format: `event-slug-year@salesforce-events` (e.g., `kiwi-dreaming-2026@salesforce-events`)
     - Set DTSTAMP to today's date in YYYYMMDDTHHMMSSZ format

## Maintenance requirements
  - When updating the README with new events or date changes, always re-sort the entire table
  - Verify chronological order after any modifications to event dates
  - Use date sorting as a validation step before finalizing README updates
  - Run the post-script verification steps every time `check-cfp-status.js` is executed
