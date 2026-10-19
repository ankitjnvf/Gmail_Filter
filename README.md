# Gmail_Filter
Outlook style eMail filtering for Gmail. This code package adds an add-on to a Gmail account to implement delayed email filtering similar to Outlook.   It automates delayed filtering as well as deletion of emails.  It is portable.  More details are in the README files. 

OVERVIEW
- Gmail's built-in filters act immediately; it does not have delay or delete automation.  
- Mail Filter adds delayed move/archive and Trash actions.
- Set Move and Delete delays independently: 1, 5, 10, 50, 100 days, or Never.
- Delays use the email's original received date.
- Match by sender and/or words, optionally require an attachment; apply rules to existing emails; optionally remove previous labels.
- View rules, automation status, and execution history. Trash is not permanent deletion.

QUICK INSTALL (FRESH INSTALLATION)
- Create an Apps Script project; paste Code.gs, Rules.html, and appsscript.json.
- Deploy the web app (User accessing / Only myself); set its /exec URL as the WEB_APP_URL Script Property.
- Install via Test deployments, authorize, and enable daily processing.

MULTIPLE GMAIL ACCOUNTS
- If RULES shows the wrong or incomplete rule list, use an Incognito/Private window.
- Sign in only to the intended Gmail account, then open Gmail > Mail Filter > RULES.

DOCUMENTATION
- README_01_Current_Version.md — Features and behavior.
- README_02_Logic_Update_Guide.md — Code and maintenance.
- README_03_Install_StepByStep_Guide.md — Detailed fresh installation.
