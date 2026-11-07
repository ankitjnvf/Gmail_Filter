# Mail Filter — Version 3.0 Updates

## 1. Rule delay options
- **Earlier:** The **Move after** and **Delete after** options were **1, 5, 10, 50, 100 days, and Never**.
- **Updated:** Replaced **50 days** with **365 days**. The available choices are now **1, 5, 10, 100, 365 days, and Never** in both the add-on and rule editor.

## 2. Nighttime processing
- **Earlier:** Processing was scheduled once per night in the **2–3 AM** window, using a daily trigger.
- **Updated:** Processing can run up to **three times per night**, during the **2 AM, 3 AM, and 4 AM** hours (America/Chicago), using one hourly trigger with a time-window check.
- **Earlier:** The add-on's **Next** field showed the next individual **2–3 AM** window.
- **Updated:** **Next** shows the full **2–5 AM** nightly window.

## 3. Email processing
- **Earlier:** Each processing pass retrieved tracked-message candidates broadly, with work organized rule by rule.
- **Updated:** Searches target **due tracked messages**, and due **moves across all rules** are processed before the deletion phase.
- **Earlier:** The processing implementation used stored cursor-offset properties for progress through message listings.
- **Updated:** Due-message searches and tracking labels determine remaining work; legacy processing cursor properties are cleaned up.
- **Retained:** A message already due for deletion goes to **Trash** without first being moved.

## 4. Processing counters
- **Earlier:** The visible add-on summary emphasized **Tracked** alongside **Next** and **Backfill**; it did not show combined nighttime action totals.
- **Updated:** The summary displays **Next**, **Backfill**, **Moved**, **Deleted**, and **Failed**. Internal **Tracked**, **Examined**, **Eligible**, and **Skipped** counts remain available.
- **Earlier:** Counters did not accumulate successful moves, deletions, and failed message attempts across multiple nightly runs.
- **Updated:** **Moved**, **Deleted**, and **Failed** accumulate across the three scheduled runs for that night. After **Run Now**, those same visible fields display the latest manual-run counts without adding them to the nighttime totals.

## 5. Execution status
- **Earlier:** Status reporting could show **Success** even when a processing pass stopped early, and the execution-history status could differ from the add-on health snapshot.
- **Updated:** **Success** requires completion of the processing pass without recorded errors or an early stop. **Partial** covers early stops and mixed outcomes (some successful actions alongside failures); **Failure** covers execution errors without successful actions when processing does not stop early.
- **Earlier:** Execution-history error notes did not consistently explain the time-limit stop or summarize recorded failures.
- **Updated:** Error notes include applicable runtime-limit information, error counts, and recorded error details; normal-completion status reporting is aligned between history and the add-on snapshot.

## 6. Processing throttle
- **Earlier:** `MESSAGE_THROTTLE_MS` was set to **500 ms**.
- **Updated:** `MESSAGE_THROTTLE_MS` is set to **0.1 ms** in the supplied Version 3.0 code.

## 7. Developer links
- **Earlier:** The add-on included the developer's **LinkedIn** link.
- **Updated:** Added the [GitHub repository](https://github.com/ankitjnvf/Gmail_Filter) alongside LinkedIn.
