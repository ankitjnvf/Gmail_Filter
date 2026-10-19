# Mail Filter — Current Version README

## 1. Purpose

**Mail Filter** is a Google Apps Script Gmail add-on that creates delayed email-management rules.

A rule can match email by:

- **From** — a sender email address or Gmail sender/domain criterion.
- **Has the words** — Gmail search terms / text criteria.
- **Has Attachment** — optionally require an attachment, in addition to From and/or Has the words.
- **Both** — if From and Has the words are filled, both conditions are used; Has Attachment further restricts either case.

At least one of **From** or **Has the words** must be entered; checking **Has Attachment** alone does not create a valid rule.

For a matching message, the rule can:

- move/archive the message after a selected delay;
- delete the message after a selected delay;
- do only one of those actions by setting the other action to **Never**;
- optionally apply the rule to already-existing matching emails;
- optionally remove previous ordinary user labels when a message is moved to its destination.

The current supported delays are:

- 1 day
- 5 days
- 10 days
- 50 days
- 100 days
- Never

The timing is based on the message's **original Gmail received date**, not on the date the rule was created. One day means 24 elapsed hours; an eligible message is processed when the daily/manual worker next runs, not at the precise instant its age crosses the threshold.

---

## 2. Files in the code package

The working package contains three files.

### `Code.gs`

This is the main Apps Script file. It contains:

- Gmail add-on UI
- rule creation and validation
- Gmail filter creation
- internal label creation
- rule storage
- existing-mail enrollment
- delayed processing
- daily trigger management
- manual `RUN NOW`
- processing safeguards, execution history, and automation health status
- message-match counting and attachment criteria
- optional removal of previous ordinary user labels
- label-name synchronization
- separate Existing Rules web-page backend
- rule editing/deletion backend
- the logic that opens the Existing Rules web page

### `Rules.html`

This is the separate **Existing Mail Rules** page.

It provides:

- rule table
- From
- Has the words
- Has Attachment
- Move information
- Delete information
- Remove Previous Labels
- green/red rule-activity indicator
- Edit button
- Delete button
- Edit modal
- execution-history table (last 10 days)
- calls back to Apps Script using `google.script.run`

### `appsscript.json`

This is the Apps Script manifest.

The current package uses:

- timezone: `America/Chicago`
- V8 runtime
- Gmail Advanced Service v1
- Gmail modify/settings/add-on scopes
- `script.scriptapp` scope for trigger management
- Gmail homepage/contextual add-on configuration
- web-app configuration (`executeAs: USER_ACCESSING`, `access: MYSELF`)
- allowed Apps Script web-app URL prefixes for Apps Script and the developer's LinkedIn link

---

## 3. Main user interface

The Gmail sidebar displays a rule-creation form with:

- `From` (prefilled from the opened Gmail message when available)
- `Has the words`
- `Has Attachment`
- `Matching existing emails` — the current count for the entered search criteria; it updates when From, words, or Has Attachment changes
- `Move to`
- `Move after`
- `Delete after`
- `Apply to existing emails`
- `Remove previous labels`
- `SAVE` — create a rule
- `RUN NOW` — execute the rule processor manually
- `RULES` — open the separate Existing Mail Rules web app

Below these controls are:

- `Next` — an estimate of the next 2–3 AM scheduled window, or `Not scheduled` when the daily trigger is not enabled;
- `Backfill` — the **number of rules** awaiting existing-mail enrollment (`backfillPending = true`), not the number of emails;
- `Tracked` — the number of tracked message entries **visited during the latest recorded worker run**, summed across rules. It is not a live mailbox count, not necessarily a unique-message count, and not the number moved/deleted;
- `ENABLE DAILY PROCESSING` — shown only if a daily trigger is not already present;
- **Recent Executions** — at most the three newest log records (timestamp and status);
- the developer credit and LinkedIn link.

`Matching existing emails` reports matches found by the current Gmail search; it does not mean those messages have already been enrolled or processed. The count can be zero until From or Has the words has been provided.

The rule-management interface is the separate web page opened by `RULES`; the old inline rule table is not part of the current sidebar code.

---

## 4. Rule validation

Before a rule is saved, the code checks the following:

1. At least one of `From` or `Has the words` must be provided; `Has Attachment` is an optional additional condition, not a standalone criterion.
2. `Move after` must be one of the supported delay values: 1, 5, 10, 50, 100 days or Never.
3. `Delete after` must be one of those same supported values.
4. If `Move after` is not `Never`, an existing destination Gmail user label must be selected.
5. `Move after` and `Delete after` cannot both be `Never`.

---

## 5. What happens when a rule is created

When `SAVE` is pressed:

1. A unique rule ID is generated.
2. Two hidden internal Gmail labels are created:
   - `ZZ_TRACK_<unique-id>`
   - `ZZ_MOVED_<unique-id>`
3. A Gmail filter is created from the `From` and/or `Has the words` criteria, with `Has Attachment` when checked.
4. That Gmail filter automatically applies the hidden tracking label to future matching email.
5. The destination Gmail label is recorded if movement is enabled.
6. The complete rule is stored in Apps Script **User Properties**.
7. The code makes sure the single daily processing trigger exists.
8. If `Apply to existing emails` was selected, the rule is marked for backfill. The backfill is processed on the next daily run or when `RUN NOW` is pressed.

Rule-property keys use the prefix:

`MR_RULE_`

---

## 6. Incoming email enrollment

The system does not scan the whole mailbox every time new mail arrives.

Instead, rule creation also creates a normal Gmail filter.

For future matching messages, Gmail itself applies the hidden tracking label:

`ZZ_TRACK_<unique-id>`

The processor later finds messages with this label and checks whether their move/delete time has arrived.

This design separates:

- **matching/enrollment** — Gmail filter
- **delayed action** — Apps Script processor

---

## 7. Applying a rule to existing emails

When `Apply to existing emails` is selected, the rule is stored with `backfillPending = true`.

During the next manual or daily processing run, the code:

1. builds a Gmail search query from the rule;
2. excludes Sent, Drafts, Spam, and Trash;
3. excludes messages that already have the tracking label;
4. finds matching existing messages;
5. applies the rule's hidden tracking label;
6. clears `backfillPending` after successful enrollment.

The user can initiate enrollment by pressing **RUN NOW**, but the processor still performs delayed actions only when the original received date meets the configured age. The `Matching existing emails` count is a search preview; the separate `Backfill` number counts pending rules.

The operation is designed so it can resume if a large mailbox scan is interrupted.

---

## 8. Delayed processing logic

The main processing function is:

`runProcessingWorker_()`

It uses a **user lock** so two processing runs do not operate on the same user's rules at the same time.

Processing occurs in two stages:

### Stage A — Pending existing-mail enrollment

Any rule with `backfillPending = true` first enrolls matching existing mail.

### Stage B — Process tracked messages

For each rule, the processor finds messages carrying that rule's hidden tracking label.

For each message it reads:

- Gmail internal received date (`internalDate`)
- current Gmail labels
- move delay
- delete delay
- whether the message has already been moved

The message age is calculated from the original Gmail received date.

### Execution monitoring and runtime safeguards

When the worker acquires the user lock, it starts an execution-history record with its type (`Manual` or `Daily`), start/end times, status, and error/notes. Records are retained for 10 days. Runs that remain recorded as `Running` for at least 15 minutes are shown as `Interrupted` on a later history read. If another worker already holds the user lock, the new attempt is skipped and no execution-history record is created for that attempt.

The normal worker budget is **5 minutes**; `RUN NOW` uses a shorter **20-second** budget. Tracked messages are throttled by **500 ms** between visits. A recognized quota/rate-limit error can cause one retry after a **15-second** wait, if enough time remains.

**Status interpretation:** `Success` means no error was collected on that run. It does **not** guarantee that all pending work was finished: a daily run that stops early because of its time budget can still be recorded as `Success`. `Failure` means one or more errors occurred. `Partial` is used for a manual run that stops early without collected errors. `Interrupted` is inferred from a stale `Running` record and is not an instantaneous crash detector. A run in progress can show `Running`.

The **Tracked** snapshot counts visits/attempts to tracked message entries in the last worker execution, including entries awaiting their due time and some failed attempts. It is not a measure of successful moves/deletions.

---

## 9. Move behavior

When the move delay is reached:

### If deletion is `Never`

The processor:

- adds the selected destination Gmail label;
- removes `INBOX`;
- removes the internal tracking label;
- removes the internal moved label if present;
- if **Remove previous labels** was selected, removes other ordinary user labels already on the message, but retains the selected destination label.

The email remains available in Gmail under the destination label / All Mail.

### If a later delete action is configured

The processor:

- adds the destination Gmail label;
- adds the hidden `MOVED` label;
- removes `INBOX`;
- keeps the tracking label so the message can still be found for later deletion;
- if **Remove previous labels** was selected, removes other ordinary user labels, but retains the selected destination and internal tracking labels.

The optional cleanup of previous labels operates on Gmail *user-created* labels, not system labels such as Starred or Important. It excludes labels starting with `ZZ_`, and does not remove the destination label. It is applied when a move becomes due, not merely when the rule is created.

---

## 10. Delete behavior

When the delete delay is reached, the processor sends the message to **Gmail Trash**.

It does **not** permanently delete the message.

After trashing, internal tracking-label cleanup is attempted.

### Delete priority

If both move and delete are already due at the time processing runs, **delete takes priority**.

Example:

- Move after = 10 days
- Delete after = 50 days
- Message age = 65 days when processed

Result: the message is sent directly to Trash rather than first performing the move operation.

---

## 11. Manual processing

`RUN NOW` calls `runProcessingWorker_('Manual', CFG.MANUAL_RUNTIME_BUDGET_MS)` directly with the **20-second** manual budget.

The implementation does **not** create a temporary one-time trigger for manual processing. This is intentional: only the permanent daily trigger is required.

If that limit is reached while work remains, the run can report `Partial`, and the sidebar says that remaining messages will be handled by the next scheduled run. If errors were collected, the run reports `Failure` and refers the user to Recent Executions or Existing Rules. Manual execution does not override the configured message-age thresholds.

---

## 12. Daily processing

The daily handler is:

`processDelayedMailRules`

The trigger is created only if one does not already exist.

Current trigger configuration:

- once per day;
- configured with `.atHour(2)`;
- project timezone: `America/Chicago`.

This means the daily processor is scheduled for the **2 AM hour in the project's current timezone**. With the current manifest, that timezone is `America/Chicago`.

Apps Script time-based triggers are not guaranteed to run at exactly 2:00 AM. Google may execute the trigger at some point within the 2 AM–3 AM local-time window. The `Next` indicator is an estimated window, not a promise or confirmation of execution. Daily runs use the normal five-minute worker budget.

---

## 13. Existing Rules web page

`RULES` opens a separate web application.

The URL is **not discovered automatically**. The code reads the Script Property `WEB_APP_URL`, which must contain the `/exec` URL of the web-app deployment belonging to the same Apps Script project/account.

The page calls `getRulesForWeb()` and displays a rule table with From, Has the words, Has Attachment, Move, Delete, Remove Previous Labels, Edit and Delete. It also displays **Execution History — Last 10 Days**, containing date/time, type, status and any recorded error/note.

A **green check** or **red cross** appears next to each From entry. For rules created during the past 365 days, green is shown *even if no email has yet matched*. For older rules, the code searches for at least one matching email within the past year (excluding Sent, Drafts, Spam and Trash). Therefore green is **not** proof that the rule successfully moved/deleted email; red indicates the current activity check found no matching email for an older rule.

When the Existing Rules page loads, `getRulesForWeb()` retrieves current user-label names once and matches them by Gmail label ID. Renamed labels are displayed under their current names, and changed names are saved in the rule's metadata when possible. The stable ID used for moving email is not altered. A deleted destination label appears as `[Missing label] ...`; Gmail label-list errors fall back to the stored name.

---

## 14. Editing a rule from the web page

The web page calls:

- `getRuleEditorData(ruleId)` to load the current rule and Gmail labels
- `updateRuleFromWeb(input)` to save changes

Important current behavior:

- If only timing or destination changes, the existing Gmail matching filter is retained.
- If `From`, `Has the words`, **or `Has Attachment`** changes, a replacement Gmail filter is created.
- The updated rule is stored.
- The old Gmail filter is then removed.
- If `Apply to existing emails` is selected during editing, the rule is marked for backfill again.
- `Has Attachment` and `Remove Previous Labels` are editable. The latter changes move-label cleanup but not matching criteria.
- The daily trigger is checked/created if needed.

---

## 15. Deleting a rule

The web page calls:

`deleteRuleFromWeb(ruleId)`

Deletion removes:

- the Gmail matching filter;
- the hidden tracking label;
- the hidden moved label;
- the stored rule property.

Deleting the rule does **not** delete the user's existing emails.

---

## 16. Rule storage

Rules are stored in:

`PropertiesService.getUserProperties()`

This means the rules belong to the user/project context.

A new Apps Script project for another Gmail account starts with its own independent rule set.

Copying the source code to another account does **not** copy the rules from the original account.

---

## 17. Gmail labels

The destination dropdown shows only user-created Gmail labels.

Internal Mail Filter labels beginning with:

`ZZ_`

are intentionally excluded from the destination dropdown.

If a destination label referenced by a saved rule is later removed from Gmail, the editor can display it as:

`[Missing label] ...`

so the condition is visible rather than silently discarded.

A **renamed** destination label is different from a deleted one: Gmail preserves its ID, so existing move rules continue to work. The Existing Rules page refreshes the displayed/saved name by ID when opened. The Gmail add-on's label dropdown already uses live labels. Internal `ZZ_` tracking labels are hidden when created; `hideExistingInternalLabelsOnce_()` also attempts a one-time hide of existing internal labels (marker `MR_INTERNAL_LABELS_HIDDEN_V1`). Do not rename or delete the internal tracking labels manually.

## 18. Impact of deleting a Gmail destination label

Deleting a Gmail destination label does **not** delete the Mail Filter rule and does **not** delete the emails that were previously moved using that label.

The outcome depends on when the label is deleted.

### A. Label is deleted after a Move-only message was already moved

Example:

- Move after = 10 days
- Delete after = Never

Once the move has already happened, the message has been removed from Inbox and the destination label was added.

If that Gmail label is later deleted:

- the email itself remains in Gmail;
- the deleted label disappears from the email;
- the email does not automatically return to Inbox;
- the message remains available in **All Mail**;
- because the move was already the final action, the rule has no further action to perform on that already-processed message.

### B. Label is deleted after a Move-then-Delete message was already moved

Example:

- Move after = 10 days
- Delete after = 50 days

After the move, the message is still tracked internally because it must later be deleted.

If the destination Gmail label is deleted after the move:

- the email remains in Gmail;
- the deleted destination label disappears;
- the internal tracking information remains;
- the message can still be sent to **Trash** when the configured delete time is reached.

### C. Label is deleted before a message reaches its Move-after time

The saved rule still contains the old Gmail label ID.

When the processor later tries to move a message to that deleted label, Gmail rejects the move operation.

In this situation:

- the Mail Filter rule remains saved;
- deleting the destination label does **not itself** delete the email;
- the move does not complete successfully while the destination label is missing;
- the processor continues handling other rules/messages;
- the affected rule should be edited and a valid destination label should be selected;
- if the same rule also has a later `Delete after` action, the message can still be sent to **Trash** once the delete delay becomes due, because delete is checked before move.

When the rule is opened in the editor, the missing destination can appear as:

`[Missing label] <old label name>`

This allows the user to identify the problem and replace the deleted label.

### Summary

| Situation | Result |
|---|---|
| Delete label after a Move-only message was moved | Email remains in All Mail; label disappears; message does not return to Inbox |
| Delete label after a Move-then-Delete message was moved | Email remains tracked and can still be sent to Trash later |
| Delete label before Move-after time | Move fails until the rule is edited to use a valid destination label; if a later Delete-after action is configured, that delete can still occur when due |
| Delete destination label | The Mail Filter rule itself is not automatically deleted |
| Delete destination label | Existing emails are not automatically deleted |

---

## 19. Current architecture

```text
Incoming email
      |
      v
Gmail matching filter
      |
      v
Hidden ZZ_TRACK_... label
      |
      v
Daily processor / RUN NOW
      |
      +--> Move/archive when due
      |
      +--> Trash when due


Gmail sidebar
      |
      +--> Create Rule
      +--> Enable Daily Processing
      +--> Run Now
      +--> Rules
                    |
                    v
              Rules.html Web App
                    |
                    +--> View
                    +--> Edit
                    +--> Delete
                    +--> Execution History (10 days)
```

---

## 20. Important design decisions in the current version

Do not change these unintentionally:

- one daily processor trigger, not one trigger per rule;
- no temporary trigger for `RUN NOW`;
- incoming mail is enrolled using Gmail filters;
- hidden Gmail labels are used for tracking;
- delayed timing uses Gmail `internalDate`;
- delete moves mail to Trash, not permanent deletion;
- delete has priority when both actions are due;
- rules are stored in User Properties;
- `WEB_APP_URL` is stored manually in Script Properties;
- the system does not call the Apps Script REST API to discover deployment URLs;
- the system does not require `script.deployments.readonly`;
- the system does not require `script.external_request` for deployment discovery;
- internal rule-property/label prefixes are `MR_RULE_` and `ZZ_`, respectively;
- recorded status and activity indicators have the limitations described above.

---

## 21. Normal user workflow

1. Create or choose a Gmail destination label.
2. Open Mail Filter in Gmail.
3. Enter `From`, `Has the words`, or both; optionally check `Has Attachment`. Review `Matching existing emails`.
4. Select destination if movement is enabled.
5. Choose move/delete delays.
6. Optionally check `Apply to existing emails` and/or `Remove previous labels`.
7. Press `SAVE`.
8. Press `RUN NOW` if immediate processing of already-old matching messages is desired.
9. Use `RULES` to view, edit, or delete saved rules and review execution history.

---

## 22. Known operational notes

- A message does not move merely because `RUN NOW` is pressed. It must also be old enough for the configured delay.
- With a 10-day rule, a message received today will not move today.
- `Apply to existing emails` is useful for testing because old messages can already satisfy the 1-, 5-, 10-, 50-, or 100-day age condition.
- A Gmail destination label must exist before it can be selected in Mail Filter.
- The web page URL is project-specific. Each Gmail account/project requires its own `WEB_APP_URL`.
- For a **fresh installation**, start with a new Apps Script project and its own `WEB_APP_URL`; this guide is not a migration procedure for older installations using different internal prefixes.
