# Mail Filter — Developer / Logic Update README

## 1. Purpose of this document

This file explains **where to make changes** when the Mail Filter behavior is modified in the future.

The current system is working. Changes should therefore be small, deliberate, and tested one feature at a time.

The three files are:

- `Code.gs` — rule engine, Gmail add-on, processing, storage, trigger, web-page backend
- `Rules.html` — Existing Rules web-page interface
- `appsscript.json` — permissions, services, Gmail add-on configuration, web-app configuration

Before editing, make a backup copy of all three files.

---

## 2. High-level rule flow

```text
Create rule
   |
   +--> validate input
   +--> create hidden TRACK label
   +--> create hidden MOVED label
   +--> create Gmail matching filter
   +--> save rule in User Properties
   +--> ensure daily trigger exists
   +--> optionally mark existing-mail backfill pending

Incoming matching email
   |
   +--> Gmail filter adds TRACK label

Manual/daily processor
   |
   +--> perform pending existing-mail backfill
   +--> find tracked messages
   +--> calculate age from Gmail internalDate
   +--> delete if delete is due
   +--> otherwise move if move is due
```

---

## 3. Configuration values

At the top of `Code.gs`, the `CFG` object contains central configuration.

Important entries:

- `RULE_PREFIX`
- `INTERNAL_LABEL_PREFIX`
- `TRIGGER_FUNCTION`
- `VALID_DELAYS`
- `MAX_RULES_ON_CARD`
- `DAY_MS`

The visible delay dropdown values are in:

`DELAY_OPTIONS`

### If adding a new delay

Example: adding `30 days`

Update **both**:

1. `CFG.VALID_DELAYS`
2. `DELAY_OPTIONS`

Then update the equivalent dropdowns in `Rules.html`:

- `editMoveAfter`
- `editDeleteAfter`

If only `Code.gs` is changed and `Rules.html` is not, the Gmail sidebar and web editor will disagree.

---

## 4. Changing rule fields

Current rule inputs are:

- From
- Has the words
- Destination label
- Move after
- Delete after
- Apply to existing emails

If a new field is added, review all of these locations in `Code.gs`:

- `buildRuleManagerCard_()` — create form
- `editRule()` — legacy/sidebar edit form
- `readRuleForm_()` — reads Gmail-card fields
- `validateRuleInput_()` — validation
- `saveRuleFromCard()` — new rule object
- `getRuleEditorData()` — data sent to web editor
- `updateRuleFromWeb()` — web edit handling
- processing functions if the field affects behavior

Also update `Rules.html`:

- editor form
- JavaScript input collection
- validation
- table output if the new field should be shown

Do not add a UI field without adding its storage/processing path.

---

## 5. Matching logic

There are two matching paths and they must remain consistent.

### Future incoming mail

Function:

`createTrackingFilter_(from, words, trackingLabelId)`

This creates the Gmail filter that enrolls future incoming mail.

Current mapping:

- `from` -> Gmail filter `from`
- `words` -> Gmail filter `query`

### Existing mail

Function:

`buildExistingSearchQuery_(rule)`

This builds the Gmail search used for `Apply to existing emails`.

Current exclusions:

- Sent
- Drafts
- Spam
- Trash

### Important maintenance rule

If matching semantics are changed, update **both**:

- `createTrackingFilter_()`
- `buildExistingSearchQuery_()`

Otherwise future incoming mail and existing-mail backfill can behave differently.

---

## 6. Hidden tracking labels

Rule creation generates:

- `__DMR__TRACK_<id>`
- `__DMR__MOVED_<id>`

Functions involved:

- `createHiddenLabel_()`
- `saveRuleFromCard()`

The prefix is controlled by:

`CFG.INTERNAL_LABEL_PREFIX`

Changing this prefix does not rename labels already created by old rules.

Therefore, changing `INTERNAL_LABEL_PREFIX` on an existing installation can leave old rules referencing old labels. Treat a prefix change as a migration, not a cosmetic rename.

---

## 7. Rule storage

Functions:

- `saveRule_()`
- `getRule_()`
- `getRules_()`
- `deleteRuleProperty_()`

Storage location:

`PropertiesService.getUserProperties()`

Property key format:

`DMR_RULE_<rule-id>`

Do not move rules to Script Properties just because `WEB_APP_URL` uses Script Properties.

They serve different purposes:

- **User Properties** = rule data
- **Script Properties** = project-level configuration such as `WEB_APP_URL`

---

## 8. Rule creation logic

Primary function:

`saveRuleFromCard(e)`

Current sequence:

1. read form;
2. validate;
3. validate destination label;
4. generate UUID;
5. create hidden TRACK label;
6. create hidden MOVED label;
7. create Gmail matching filter;
8. resolve destination label;
9. construct rule object;
10. save rule;
11. ensure daily trigger;
12. leave `backfillPending = true` if Apply to existing was requested;
13. refresh Gmail card.

The error path attempts to clean up partially created resources.

When modifying rule creation, preserve this cleanup behavior.

---

## 9. Existing-mail backfill

Functions:

- `applyRuleToExisting_(rule)`
- `buildExistingSearchQuery_(rule)`
- `runProcessingWorker_()`

The backfill uses:

`backfillPending`

The worker clears this flag only after successful enrollment.

Do not clear `backfillPending` before `applyRuleToExisting_()` succeeds, or a failed mailbox scan may never resume.

---

## 10. Processor logic

Main functions:

- `processDelayedMailRules()`
- `runProcessingWorker_()`
- `processSingleRule_()`
- `listTrackedMessageIds_()`
- `processTrackedMessage_()`

### `runProcessingWorker_()`

Responsibilities:

- acquire user lock;
- process pending backfills;
- reload rules;
- process every rule;
- release lock.

### `processTrackedMessage_()`

This is the main delayed-action decision function.

Current order is important:

1. read message and original `internalDate`;
2. calculate age;
3. determine move/delete delays;
4. **check delete first**;
5. then evaluate movement.

Do not move the delete check below the move check unless the product behavior is intentionally being changed.

---

## 11. Moving messages

Current move behavior is inside:

`processTrackedMessage_()`

When move is final (`Delete after = Never`):

- destination label is added;
- `INBOX` is removed;
- TRACK is removed;
- MOVED is removed.

When deletion will happen later:

- destination label is added;
- MOVED is added;
- `INBOX` is removed;
- TRACK remains for future deletion.

If changing movement behavior, preserve the difference between:

- move-only rules;
- move-then-delete rules.

---

## 12. Deleting messages

Current deletion uses:

`Gmail.Users.Messages.trash(...)`

This sends mail to Gmail Trash.

It is intentionally **not permanent deletion**.

After trashing, tracking-label cleanup is best-effort.

Do not replace this with a permanent-delete API unless that change is explicitly intended and reviewed.

---

## 13. Manual processing

Function:

`runRulesNowFromCard()`

Current behavior:

`runProcessingWorker_()` is called directly.

Do not restore a one-time trigger such as:

- `scheduleWorkerSoon_()`
- `runDelayedMailWorker()`

unless there is a specific new reason to redesign processing.

The current architecture intentionally avoids creating temporary time-based triggers.

---

## 14. Daily trigger

Functions:

- `enableDailyProcessing()`
- `ensureDailyTrigger_()`
- `dailyTriggerExists_()`

The handler name comes from:

`CFG.TRIGGER_FUNCTION`

Current schedule:

```javascript
.timeBased()
.everyDays(1)
.atHour(2)
```

The current project manifest uses the timezone:

```text
America/Chicago
```

Therefore, the processor is currently scheduled for the **2 AM hour in the project timezone**. Apps Script may execute it at some point within the 2 AM–3 AM local-time window rather than exactly at 2:00 AM.

If the project timezone is changed in `appsscript.json`, the trigger's local execution hour follows that project timezone.

If the daily time is changed, edit only `ensureDailyTrigger_()` and test trigger creation.

### Important

Changing the source code does not automatically modify an already-created trigger's schedule.

If the schedule itself is changed, delete the old project trigger in Apps Script and create/enable the new one again.

---

## 15. Existing Rules web page

Backend functions in `Code.gs`:

- `doGet()`
- `getRulesForWeb()`
- `getRuleEditorData()`
- `updateRuleFromWeb()`
- `deleteRuleFromWeb()`
- `openExistingRulesPage()`

Frontend:

`Rules.html`

### Data loading

`Rules.html` calls:

`getRulesForWeb()`

### Edit

`Rules.html` calls:

- `getRuleEditorData(ruleId)`
- `updateRuleFromWeb(input)`

### Delete

`Rules.html` calls:

`deleteRuleFromWeb(ruleId)`

Function names must stay synchronized between the HTML and `Code.gs`.

---

## 16. Web-edit filter replacement

The current web edit logic is intentionally conservative.

If `From` / `Has the words` did not change:

- no new Gmail filter is created.

If matching criteria changed:

1. create replacement filter;
2. save updated rule;
3. remove old filter.

If rule saving fails, the newly created replacement filter is removed and the old filter remains.

Preserve this sequence unless there is a tested reason to alter it.

---

## 17. Legacy Gmail-card edit code

`Code.gs` still contains:

- `editRule()`
- `updateRuleFromCard()`
- `deleteRuleFromCard()`
- code that builds `listSection`

But the line that adds `listSection` to the main Gmail card is currently commented out.

Therefore, the normal current UI uses the separate Existing Rules page.

Do not assume unused-looking functions are safe to delete without first checking whether another code path still references them.

---

## 18. `WEB_APP_URL`

Function:

`openExistingRulesPage()`

The current implementation reads:

`WEB_APP_URL`

from:

`PropertiesService.getScriptProperties()`

The URL should be the deployed web application's `/exec` URL.

Do not:

- hard-code one account's URL into `Code.gs`;
- use `ScriptApp.getService().getUrl()` as a replacement;
- add automatic deployment discovery;
- call the Apps Script REST API just to determine the URL.

Each copied installation should have its own Script Property value.

---

## 19. Updating `Rules.html`

The page currently contains:

- Existing Mail Rules table
- Edit modal
- client-side validation
- `google.script.run` calls
- HTML escaping helpers

When editing the page:

1. edit the raw Apps Script `Rules.html`;
2. do not edit a browser-saved copy containing injected scripts;
3. do not save the source through a rich-text editor that converts code to formatted HTML;
4. save the Apps Script project;
5. update the web-app deployment to a **new version**.

If the same deployment is updated to a new version, its `/exec` URL normally remains the same, so `WEB_APP_URL` does not need to change.

---

## 20. Updating `Code.gs`

For code changes:

1. back up the working file;
2. make one logical change at a time;
3. save;
4. test the changed function;
5. refresh Gmail;
6. verify rule creation;
7. verify `RUN RULES NOW`;
8. verify Existing Rules page if web-related functions changed.

If the changed code is used by the web app, update the existing web-app deployment to a new version.

---

## 21. Updating `appsscript.json`

The manifest controls permissions and add-on/web-app behavior.

Current scopes include:

- `gmail.modify`
- `gmail.settings.basic`
- `gmail.addons.current.message.readonly`
- `gmail.addons.execute`
- `script.scriptapp`

Do not add scopes unless a new feature genuinely requires them.

In particular, the current version does **not** require deployment-reading or external-request scopes merely to open the Existing Rules page.

Changing OAuth scopes can force reauthorization.

---

## 22. Safe-change checklist

Before considering a modified version complete, verify:

- Gmail sidebar opens.
- Destination-label dropdown loads.
- A From-only rule can be created.
- A words-only rule can be created.
- Gmail filter is created.
- Rule appears in Existing Rules page.
- Edit works.
- Delete works.
- `RUN RULES NOW` completes.
- Apply-to-existing works.
- Move removes `INBOX` and adds destination label.
- Delete sends the message to Trash.
- Daily trigger exists only once.
- `SHOW EXISTING RULES` opens the correct project's web page.
- No temporary worker triggers accumulate.
- `WEB_APP_URL` still points to the active `/exec` deployment.

---

## 23. Changes that should be treated as architectural changes

Do not make these casually:

- replacing Gmail filters with mailbox polling;
- changing from User Properties to another rule store;
- replacing hidden labels with another tracking mechanism;
- creating one trigger per rule;
- reintroducing temporary triggers;
- changing timing from Gmail received date to rule-created date;
- permanently deleting email instead of using Trash;
- automatically discovering the deployment URL;
- attaching the solution to a separate Google Cloud project solely for URL discovery.

Any of these should be developed and tested as a new version rather than as a small patch.
