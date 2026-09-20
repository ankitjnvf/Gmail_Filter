# Mail Filter — Step-by-Step Installation on Another Gmail Account

## Read this first

This guide is written for a user who has **no coding experience**.

You already have a complete working code package containing:

- `Code.gs`
- `Rules.html`
- `appsscript.json`

You do **not** need to understand or edit the program logic.

Your job is only to:

1. create a new Apps Script project while signed in to the Gmail account that will use Mail Filter;
2. copy the three supplied files into the correct places;
3. deploy the Existing Rules web page;
4. save its URL as the `WEB_APP_URL` Script Property;
5. install the Gmail add-on;
6. authorize it;
7. enable daily processing;
8. perform the verification tests.

Each Gmail account should have its **own Apps Script project and its own web-app URL**.

Do not reuse the `WEB_APP_URL` from another Gmail account.

---

# Part A — Before you begin

You need:

- the Gmail account where Mail Filter will be installed;
- a web browser;
- the three working files listed above.

It is easiest to use one browser profile and remain signed in to the target Gmail account for the entire installation.

### Important

Do not create or attach a separate Google Cloud project for this installation.

Do not enable the Apps Script API for deployment-URL discovery.

Do not add a URL directly into `Code.gs`.

---

# Part B — Create the Apps Script project

## Step 1 — Sign in to the correct Gmail account

Open Gmail and confirm that the account shown in the upper-right corner is the account where Mail Filter should run.

Keep this account signed in.

---

## Step 2 — Create a new Apps Script project

In a new browser tab, open:

`https://script.new`

A new Google Apps Script project opens.

At the upper-left, click **Untitled project**.

Rename it, for example:

`Mail Filter`

Click **Rename**.

---

# Part C — How to open the supplied files for copy/paste

The three supplied files are plain-text source-code files. You do **not** need special programming software to understand them, but you do need to open them as **text/source files** so you can copy their complete contents.

The recommended tool is **Visual Studio Code (VS Code)** because it opens `.gs`, `.html`, and `.json` files as plain source code without changing them.

## Step 3 — Open the supplied files in VS Code

If VS Code is not installed, download and install **Visual Studio Code**.

Then:

1. Open **VS Code**.
2. In Finder (Mac) or File Explorer (Windows), locate the supplied Mail Filter code package.
3. Drag `Code.gs` into the VS Code window.
4. You should see normal source code text.
5. Press **Command+A** on Mac or **Ctrl+A** on Windows.
6. Press **Command+C** on Mac or **Ctrl+C** on Windows to copy the entire file.

You will repeat the same process later for:

- `Rules.html`
- `appsscript.json`

### Important for `Rules.html`

Do **not** double-click `Rules.html` and copy from Safari, Chrome, Edge, or another browser.

A browser may display the page instead of the actual HTML source code.

Open `Rules.html` in **VS Code** or another plain-text editor.

### If you do not want to install VS Code

You may use another plain-text editor.

On Mac, **TextEdit** can be used only in plain-text mode:

1. Open TextEdit.
2. Choose **Format -> Make Plain Text**.
3. Choose **File -> Open**.
4. Open the required `.gs`, `.html`, or `.json` file.
5. Copy the entire text.

Do not use rich-text mode.

### File-to-tab mapping

Use this exact mapping:

| Supplied file | Open it with | Paste into Apps Script |
|---|---|---|
| `Code.gs` | VS Code / plain-text editor | `Code.gs` |
| `Rules.html` | VS Code / plain-text editor | `Rules.html` |
| `appsscript.json` | VS Code / plain-text editor | `appsscript.json` |

Always copy the **entire contents** of each supplied file.

---

# Part D — Add `Code.gs`


## Step 4 — Open the default `Code.gs`

On the left side of the Apps Script editor, under **Files**, click:

`Code.gs`

A new project normally contains a small example such as:

```javascript
function myFunction() {
}
```

Select everything in the editor and delete it.

---

## Step 5 — Paste the supplied `Code.gs`

Open the `Code.gs` file from the working code package.

Copy its **entire contents**.

Return to the Apps Script `Code.gs` tab.

Paste the complete code.

Press **Ctrl+S** on Windows or **Command+S** on Mac, or click the Save icon.

Do not change the function names.

---

# Part E — Add `Rules.html`

## Step 6 — Create the HTML file

In the Apps Script editor, look beside **Files** in the left panel.

Click the **+** button.

Choose:

**HTML**

For the file name, enter exactly:

`Rules`

Apps Script will display the file as:

`Rules.html`

The capital `R` matters because `Code.gs` loads a file named `Rules`.

---

## Step 7 — Paste the supplied `Rules.html`

Open the `Rules.html` file from the working package.

Copy its complete raw HTML source.

In Apps Script, click `Rules.html`.

Delete any existing content and paste the complete supplied HTML.

Save the project.

### Important

Use the `Rules.html` supplied in the code package.

Do not copy HTML from a browser's **Save Page As** output.

Do not open and resave the source through a rich-text editor such as TextEdit in rich-text mode.

The Apps Script file must contain the actual HTML source.

---

# Part F — Add `appsscript.json`

## Step 8 — Make the manifest visible

In the left sidebar of Apps Script, click the **gear icon**:

**Project Settings**

Find the setting:

**Show "appsscript.json" manifest file in editor**

Turn it **ON**.

Return to the **Editor** using the code/editor icon on the left.

You should now see:

`appsscript.json`

under Files.

---

## Step 9 — Replace the manifest

Click:

`appsscript.json`

Select all of its existing contents and delete them.

Open the supplied `appsscript.json` from the working package.

Copy the entire JSON content.

Paste it into the Apps Script `appsscript.json` tab.

Save the project.

The supplied manifest already declares the Gmail Advanced Service and required scopes. Do not add deployment-discovery scopes.

---

# Part G — Check the three files

Before deploying, the Apps Script project should contain:

```text
Code.gs
Rules.html
appsscript.json
```

It is fine if Apps Script shows other normal project UI items, but there should not be an old duplicate script file containing another copy of the Mail Filter functions.

A duplicate `Code.gs`-style file can cause unexpected behavior because Apps Script loads project script files together.

---

# Part H — Deploy the Existing Rules web page

The `SHOW EXISTING RULES` button needs a normal deployed web-app URL.

## Step 10 — Start a web-app deployment

At the upper-right of the Apps Script editor, click:

**Deploy**

Choose:

**New deployment**

Next to **Select type**, click the deployment-type/settings icon.

Choose:

**Web app**

---

## Step 11 — Configure the web app

Use these settings:

**Description**

You can enter:

`Existing Rules Page`

**Execute as**

Choose:

`User accessing the web app`

**Who has access**

Choose:

`Only myself`

Then click:

**Deploy**

Google may ask for authorization. Follow the authorization prompts and allow the permissions required by the project.

---

## Step 12 — Copy the Web App URL

Immediately after you click **Deploy**, Apps Script opens a deployment-result window.

In that window, look for the section labeled:

**Web app**

Under it, you should see a field labeled:

**Web app URL**

The URL will look similar to:

```text
https://script.google.com/macros/s/....../exec
```

To copy it:

1. Find **Web app URL** in the deployment-result window.
2. Click the **Copy** icon/button next to the URL, or select the entire URL and copy it manually.
3. Make sure the copied URL ends with:

```text
/exec
```

Do **not** use a `/dev` URL.

Keep this `/exec` URL available because you will paste it into the `WEB_APP_URL` Script Property in the next part.

### If you already closed the deployment-result window

You can find the URL again:

1. In Apps Script, click **Deploy** in the upper-right corner.
2. Click **Manage deployments**.
3. In the left side of the deployment window, select the deployment whose type is **Web app**.
4. Look for the **Web app URL** in the deployment details.
5. Click the copy icon next to the URL.
6. Confirm that it ends with `/exec`.

This is the URL that belongs to this Apps Script project and this Gmail-account installation.

---

# Part I — Add the URL to Script Properties

This step is required for **SHOW EXISTING RULES**.

## Step 13 — Open Project Settings

In Apps Script, click the **gear icon** on the left:

**Project Settings**

Scroll down until you find:

**Script Properties**

---

## Step 14 — Add `WEB_APP_URL`

If no Script Property exists yet, click:

**Add script property**

If properties already exist, click:

**Edit script properties**

and then:

**Add script property**

Enter exactly:

**Property**

```text
WEB_APP_URL
```

**Value**

Paste the `/exec` URL copied from the web-app deployment.

Example:

```text
https://script.google.com/macros/s/....../exec
```

Click:

**Save script properties**

### Check carefully

The property name must be exactly:

`WEB_APP_URL`

Do not add spaces.

Do not place quotation marks around the URL.

Do not paste another account's URL.

---

# Part J — Install the Gmail add-on

## Step 15 — Install the test deployment

Return to the Apps Script editor.

Click:

**Deploy**

Choose:

**Test deployments**

In the test-deployment window, click:

**Install**

After installation completes, click:

**Done**

Google's current Apps Script documentation uses this Test deployments -> Install flow for unpublished Google Workspace add-ons.

---

# Part K — Open Mail Filter in Gmail

## Step 16 — Refresh Gmail

Return to Gmail.

Refresh the Gmail browser tab.

Look at the right-side Gmail add-on panel.

Open:

**Mail Filter**

If the sidebar is collapsed, expand the add-on area first.

The Mail Filter card should appear.

---

# Part L — Authorization

## Step 17 — Authorize when Google asks

The first time the add-on uses Gmail or trigger functions, Google can display an authorization window.

Choose the same Gmail account being configured.

Review the permissions.

Click **Allow** / **Continue** as presented by Google.

If Google does not ask immediately, opening Mail Filter, loading its Gmail labels, saving the first rule, or enabling daily processing can trigger the authorization request.

Do not authorize using a different Gmail account.

---

# Part M — Enable daily processing

## Step 18 — Click `ENABLE DAILY PROCESSING`

Open Mail Filter in Gmail.

If you see the button:

`ENABLE DAILY PROCESSING`

click it once.

After the daily trigger exists, this button should no longer be necessary.

The code also checks for the trigger when a rule is saved, but explicitly enabling it during installation is a useful setup check.

### Current daily-run time

The current code creates the daily trigger with:

```javascript
.atHour(2)
```

and the supplied `appsscript.json` uses the project timezone:

```text
America/Chicago
```

Therefore, the daily processor is currently scheduled for the **2 AM hour in the project's current timezone**.

Apps Script does not guarantee execution at exactly 2:00 AM. The daily run may occur at some point within the 2 AM–3 AM local-time window.

If the project timezone is changed later, the trigger's local schedule follows that project timezone.

---


## Important — Initial activation may take a little time

Immediately after installation, authorization, and activation, the Gmail add-on may not respond perfectly on the very first attempt.

In particular, you may notice that:

- `SAVE RULE` appears to do nothing;
- `RUN RULES NOW` appears not to run;
- a newly created rule does not appear immediately;
- the add-on seems to need a short time before it begins behaving normally.

This can happen during the initial setup/activation period.

If this happens:

1. Do **not** immediately change the code.
2. Wait a few minutes.
3. Refresh Gmail.
4. Reopen the Mail Filter sidebar.
5. Try `SAVE RULE` or `RUN RULES NOW` again.

During our setup, these functions began working normally after a short wait.

Treat a short initial delay as a setup/activation issue first. Only investigate the code if the problem continues after waiting, refreshing Gmail, and reopening the add-on.

---

# Part N — Confirm the Existing Rules page

## Step 19 — Click `SHOW EXISTING RULES`

In the Mail Filter sidebar, click:

`SHOW EXISTING RULES`

A separate browser page should open.

Initially it may display:

`No existing rules.`

That is normal on a fresh installation.

### Important if multiple Gmail / Google accounts are logged in

If more than one Google account is signed in to the normal browser session, the web-app page may open under the wrong Google account or may fail to display correctly.

For the verification, the page should still be opened by clicking **`SHOW EXISTING RULES`**. Do not use the direct `/exec` URL as the normal verification method.

Use this procedure:

1. Open an **Incognito** window in Chrome, or a **Private** window in another browser.
2. In that Incognito/Private window, sign in **only** to the Gmail account where this Mail Filter project is installed.
3. Open **Gmail inside the same Incognito/Private window**.
4. Open the **Mail Filter** add-on from Gmail's right-side panel.
5. Click **`SHOW EXISTING RULES`** from the Mail Filter sidebar.
6. Confirm that the Existing Rules web page opens successfully in that same Incognito/Private browser session.

This verifies the actual button, the account context, the web-app deployment, and `WEB_APP_URL` together.

Only if the button does not open the page should the `/exec` URL be used separately as a **troubleshooting/backup test** to determine whether the web-app deployment itself is reachable.

If only one Google account is logged in and `SHOW EXISTING RULES` opens correctly, Incognito mode is not necessary.

If the page opens, the following are working together:

- web-app deployment;
- `WEB_APP_URL` Script Property;
- `doGet()`;
- `Rules.html`.

---

# Part O — Prepare for functional testing

The shortest way to test the 10-day timing immediately is to use **existing emails that are already more than 10 days old**.

New emails received today will not move immediately under a 10-day rule.

## Step 20 — Create a test destination Gmail label

In Gmail, create a normal user label called:

`MailFilter-Test`

Use this label as the destination during the tests.

---

## Step 21 — Choose four old test messages

Find four emails in the mailbox that are older than 10 days.

Prefer messages that are easy to identify and safe to move or trash.

You will use:

- Email Case 1 — sender-based move
- Email Case 2 — sender-based delete
- Word Case 1 — word-based move
- Word Case 2 — word-based delete

Record the sender/words before creating the rules.

Avoid choosing critical email for the delete tests.

---

# Part P — Test 1: Email Case 1 — From-only move

## Goal

Verify sender matching and movement.

## Step 22

Choose an existing email older than 10 days from a sender that is easy to identify.

Example sender:

`sender-one@example.com`

In Mail Filter enter:

**From**

the exact sender email

**Has the words**

leave blank

**Move to**

`MailFilter-Test`

**Move after**

`10 days`

**Delete after**

`Never`

Check:

`Apply to existing emails`

Click:

`SAVE RULE`

Then click:

`RUN RULES NOW`

## Expected result

The old matching email should:

- leave Inbox;
- receive the `MailFilter-Test` label;
- remain available in Gmail / All Mail;
- not be sent to Trash.

Open `SHOW EXISTING RULES` and verify the rule is listed.

---

# Part Q — Test 2: Email Case 2 — From-only delete

## Goal

Verify sender matching and Trash behavior.

## Step 23

Choose a different existing email older than 10 days from another sender.

In Mail Filter enter:

**From**

the second sender's email

**Has the words**

leave blank

**Move after**

`Never`

Because Move is Never, no destination label is required.

**Delete after**

`10 days`

Check:

`Apply to existing emails`

Click:

`SAVE RULE`

Then click:

`RUN RULES NOW`

## Expected result

The old matching email should appear in:

**Trash**

The code uses Gmail Trash; it does not permanently delete the message.

---

# Part R — Test 3: Word Case 1 — words-only move

## Goal

Verify `Has the words` matching without a sender condition.

## Step 24

Choose an old email containing a distinctive word or phrase.

For example, if an old email contains:

`TESTWORD-MOVE`

use that phrase.

In Mail Filter enter:

**From**

leave blank

**Has the words**

enter the distinctive word/phrase

**Move to**

`MailFilter-Test`

**Move after**

`10 days`

**Delete after**

`Never`

Check:

`Apply to existing emails`

Click:

`SAVE RULE`

Then click:

`RUN RULES NOW`

## Expected result

The matching old email should:

- leave Inbox;
- receive the `MailFilter-Test` label;
- not go to Trash.

---

# Part S — Test 4: Word Case 2 — words-only delete

## Goal

Verify word matching and delete timing.

## Step 25

Choose another old non-critical email containing a different distinctive word/phrase.

Example:

`TESTWORD-DELETE`

In Mail Filter enter:

**From**

leave blank

**Has the words**

enter the second word/phrase

**Move after**

`Never`

**Delete after**

`10 days`

Check:

`Apply to existing emails`

Click:

`SAVE RULE`

Then click:

`RUN RULES NOW`

## Expected result

The matching old email should be sent to:

**Trash**

---

# Part T — Verify the four rules

## Step 26 — Open Existing Rules

Click:

`SHOW EXISTING RULES`

### If multiple Gmail / Google accounts are logged in

Perform this verification from an **Incognito / Private** browser session:

1. Sign in only to the Gmail account where this Mail Filter installation is running.
2. Open Gmail in that same Incognito/Private window.
3. Open the Mail Filter sidebar.
4. Click **`SHOW EXISTING RULES`**.
5. Confirm that the Existing Rules page opens from the button.

The `/exec` URL should be used only as a troubleshooting/backup check if the button does not open the page. The normal verification is that **`SHOW EXISTING RULES` works directly from the Gmail add-on**.

Verify that the rules appear in the table with the expected:

- From
- Has the words
- Move
- Delete

---

# Part U — Verify rule edit and deletion

## Step 27 — Verify rule editing

On the Existing Rules page, choose a non-critical test rule.

Click:

`EDIT`

Confirm that the edit window opens and shows the rule's current values.

Change one safe field, for example:

- change `Move after` from `10 days` to `50 days`, or
- change `Delete after` from `Never` to `100 days`, or
- select a different test destination label.

Click:

`SAVE`

The edit window should close and the Existing Rules table should refresh.

Verify that the updated value now appears in the table.

If you changed a rule only for testing, you can edit it again and return it to its original value.

### Additional edit test for matching criteria

If desired, use another non-critical test rule and change:

- `From`, or
- `Has the words`

Save the edit and confirm that the rule still appears correctly.

This verifies that the rule's Gmail matching filter can also be updated.

---

## Step 28 — Verify rule deletion

On the Existing Rules page, choose a test rule you no longer need.

Click:

`DELETE`

Confirm deletion.

The rule should disappear from the table.

Deleting a rule removes the rule/filter/tracking resources; it does not delete the emails that already exist in the mailbox.

---

# Part V — Verify future incoming-mail matching

The four tests above confirm the delayed processor using existing mail.

You should also confirm that new incoming mail is enrolled by Gmail filters.

## Step 29

Keep one harmless From-based test rule active.

Send a new email from that matching sender to the target Gmail account.

Because the new message is not yet 10 days old, it should **not move immediately**.

That is correct.

The Gmail filter enrolls it for future delayed processing, and it will become eligible when its configured age is reached.

Do the same for a harmless words-based rule by sending a new email containing its matching word/phrase.

Again, a new message should remain until it reaches the configured delay.

---

# Part W — Final installation checklist

The installation is complete when all of the following are true:

- `Code.gs` is present.
- `Rules.html` is present.
- `appsscript.json` is present.
- Web app has been deployed.
- You copied the production `/exec` URL.
- Script Property `WEB_APP_URL` contains that exact `/exec` URL.
- Gmail test deployment is installed.
- Mail Filter appears in Gmail.
- Authorization has been granted for the correct Gmail account.
- Daily processing is enabled.
- Daily processing is configured for the 2 AM hour in the project timezone (`America/Chicago` in the supplied manifest).
- `SHOW EXISTING RULES` opens successfully.
- From-based rule creation works.
- Words-based rule creation works.
- `RUN RULES NOW` works.
- A move test adds the destination label and removes Inbox.
- A delete test sends the message to Trash.
- Existing Rules page shows, edits, and deletes rules.

---

# Part X — What NOT to do

For this working version:

- Do not attach a separate Google Cloud project just for installation.
- Do not enable Apps Script API just to find the web-app URL.
- Do not add `script.deployments.readonly`.
- Do not add `script.external_request` for URL discovery.
- Do not use another account's web-app URL.
- Do not paste the web-app URL directly into `Code.gs`.
- Do not use a `/dev` test URL as `WEB_APP_URL`.
- Do not create manual temporary processor triggers.
- Do not change `Rules.html` through a rich-text editor.
- Do not rename `Rules.html` unless the `doGet()` code is also intentionally changed.

---

# Part Y — Updating the web app later

If the code package is updated later and `Rules.html` or web-page backend functions change:

1. open the same Apps Script project;
2. replace/update the supplied code;
3. save;
4. click **Deploy -> Manage deployments**;
5. select the existing web-app deployment;
6. click the Edit/pencil icon;
7. select a **New version**;
8. click **Deploy**.

When the existing deployment is updated rather than replaced, the same `/exec` URL can normally continue to be used.

If a completely new web-app deployment is created and its `/exec` URL changes, return to:

**Project Settings -> Script Properties**

and replace the value of:

`WEB_APP_URL`

with the new URL.
