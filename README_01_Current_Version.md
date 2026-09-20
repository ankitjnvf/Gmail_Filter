# Mail Filter — Current Version README

## 1. Purpose

**Mail Filter** is a Google Apps Script Gmail add-on that creates delayed email-management rules.

A rule can match email by:

- **From** — a sender email address or sender criterion.
- **Has the words** — Gmail search terms / text criteria.
- **Both** — if both fields are filled, both conditions are used.

For a matching message, the rule can:

- move/archive the message after a selected delay;
- delete the message after a selected delay;
- do only one of those actions by setting the other action to **Never**;
- optionally apply the rule to already-existing matching emails.

The current supported delays are:

- 10 days
- 50 days
- 100 days
- Never

The timing is based on the message's **original Gmail received date**, not on the date the rule was created.

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
- manual `RUN RULES NOW`
- separate Existing Rules web-page backend
- rule editing/deletion backend
- the logic that opens the Existing Rules web page

### `Rules.html`

This is the separate **Existing Mail Rules** page.

It provides:

- rule table
- From
- Has the words
- Move information
- Delete information
- Edit button
- Delete button
- Edit modal
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
- web-app configuration
- allowed Apps Script web-app URL prefix

---

## 3. Main user interface

The Gmail sidebar contains a **Create Rule** form with:

- `From`
- `Has the words`
- `Move to`
- `Move after`
- `Delete after`
- `Apply to existing emails`
- `SAVE RULE`

The bottom automation area contains:

- `ENABLE DAILY PROCESSING` — shown only when the daily trigger does not already exist
- `RUN RULES NOW`
- `SHOW EXISTING RULES`

The old inline Existing Rules list is still built in `Code.gs`, but it is currently **not displayed in the Gmail sidebar**. The active rule-management interface is the separate web page opened by `SHOW EXISTING RULES`.

---

## 4. Rule validation

Before a rule is saved, the code checks the following:

1. At least one of `From` or `Has the words` must be provided.
2. `Move after` must be one of the supported delay values.
3. `Delete after` must be one of the supported delay values.
4. If `Move after` is not `Never`, a destination Gmail label must be selected.
5. `Move after` and `Delete after` cannot both be `Never`.

---

## 5. What happens when a rule is created

When `SAVE RULE` is pressed:

1. A unique rule ID is generated.
2. Two hidden internal Gmail labels are created:
   - `__DMR__TRACK_<unique-id>`
   - `__DMR__MOVED_<unique-id>`
3. A Gmail filter is created from the `From` and/or `Has the words` criteria.
4. That Gmail filter automatically applies the hidden tracking label to future matching email.
5. The destination Gmail label is recorded if movement is enabled.
6. The complete rule is stored in Apps Script **User Properties**.
7. The code makes sure the single daily processing trigger exists.
8. If `Apply to existing emails` was selected, the rule is marked for backfill. The backfill is processed on the next daily run or when `RUN RULES NOW` is pressed.

Rule-property keys use the prefix:

`DMR_RULE_`

---

## 6. Incoming email enrollment

The system does not scan the whole mailbox every time new mail arrives.

Instead, rule creation also creates a normal Gmail filter.

For future matching messages, Gmail itself applies the hidden tracking label:

`__DMR__TRACK_<unique-id>`

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

---

## 9. Move behavior

When the move delay is reached:

### If deletion is `Never`

The processor:

- adds the selected destination Gmail label;
- removes `INBOX`;
- removes the internal tracking label;
- removes the internal moved label if present.

The email remains available in Gmail under the destination label / All Mail.

### If a later delete action is configured

The processor:

- adds the destination Gmail label;
- adds the hidden `MOVED` label;
- removes `INBOX`;
- keeps the tracking label so the message can still be found for later deletion.

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

`RUN RULES NOW` directly calls the processing worker.

The current implementation does **not** create a temporary one-time trigger for manual processing.

This is intentional. Only the permanent daily processor trigger is required.

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

Apps Script time-based triggers are not guaranteed to run at exactly 2:00 AM. Google may execute the trigger at some point within the 2 AM–3 AM local-time window.

---

## 13. Existing Rules web page

`SHOW EXISTING RULES` opens a separate web application.

The URL is **not discovered automatically**.

The code reads this Script Property:

`WEB_APP_URL`

That property's value must be the `/exec` URL of the web-app deployment belonging to the same Apps Script project/account.

The page loads the rule list using:

`getRulesForWeb()`

It provides Edit and Delete actions.

---

## 14. Editing a rule from the web page

The web page calls:

- `getRuleEditorData(ruleId)` to load the current rule and Gmail labels
- `updateRuleFromWeb(input)` to save changes

Important current behavior:

- If only timing or destination changes, the existing Gmail matching filter is retained.
- If `From` or `Has the words` changes, a replacement Gmail filter is created.
- The updated rule is stored.
- The old Gmail filter is then removed.
- If `Apply to existing emails` is selected during editing, the rule is marked for backfill again.
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

`__DMR__`

are intentionally excluded from the destination dropdown.

If a destination label referenced by a saved rule is later removed from Gmail, the editor can display it as:

`[Missing label] ...`

so the condition is visible rather than silently discarded.

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
Hidden __DMR__TRACK_... label
      |
      v
Daily processor / RUN RULES NOW
      |
      +--> Move/archive when due
      |
      +--> Trash when due


Gmail sidebar
      |
      +--> Create Rule
      +--> Enable Daily Processing
      +--> Run Rules Now
      +--> Show Existing Rules
                    |
                    v
              Rules.html Web App
                    |
                    +--> View
                    +--> Edit
                    +--> Delete
```

---

## 20. Important design decisions in the current version

Do not change these unintentionally:

- one daily processor trigger, not one trigger per rule;
- no temporary trigger for `RUN RULES NOW`;
- incoming mail is enrolled using Gmail filters;
- hidden Gmail labels are used for tracking;
- delayed timing uses Gmail `internalDate`;
- delete moves mail to Trash, not permanent deletion;
- delete has priority when both actions are due;
- rules are stored in User Properties;
- `WEB_APP_URL` is stored manually in Script Properties;
- the system does not call the Apps Script REST API to discover deployment URLs;
- the system does not require `script.deployments.readonly`;
- the system does not require `script.external_request` for deployment discovery.

---

## 21. Normal user workflow

1. Create or choose a Gmail destination label.
2. Open Mail Filter in Gmail.
3. Enter `From`, `Has the words`, or both.
4. Select destination if movement is enabled.
5. Choose move/delete delays.
6. Optionally check `Apply to existing emails`.
7. Press `SAVE RULE`.
8. Press `RUN RULES NOW` if immediate processing of already-old matching messages is desired.
9. Use `SHOW EXISTING RULES` to view, edit, or delete saved rules.

---

## 22. Known operational notes

- A message does not move merely because `RUN RULES NOW` is pressed. It must also be old enough for the configured delay.
- With a 10-day rule, a message received today will not move today.
- `Apply to existing emails` is useful for testing because old messages can already satisfy the 10/50/100-day age condition.
- A Gmail destination label must exist before it can be selected in Mail Filter.
- The web page URL is project-specific. Each Gmail account/project requires its own `WEB_APP_URL`.
