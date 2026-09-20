const CFG = Object.freeze({
  RULE_PREFIX: 'DMR_RULE_',
  INTERNAL_LABEL_PREFIX: '__DMR__',
  TRIGGER_FUNCTION: 'processDelayedMailRules',
  VALID_DELAYS: ['10', '50', '100', 'never'],
  MAX_RULES_ON_CARD: 40,
  DAY_MS: 24 * 60 * 60 * 1000
});

const DELAY_OPTIONS = Object.freeze([
  { label: '10 days', value: '10' },
  { label: '50 days', value: '50' },
  { label: '100 days', value: '100' },
  { label: 'Never', value: 'never' }
]);

/* =========================================================
   GMAIL ADD-ON ENTRY POINTS
   ========================================================= */

function onHomePage(e) {
  return [buildRuleManagerCard_('')];
}

function onGmailMessageOpen(e) {
  let senderEmail = '';

  try {
    if (e && e.gmail && e.gmail.accessToken && e.gmail.messageId) {
      GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
      const message = GmailApp.getMessageById(e.gmail.messageId);
      senderEmail = extractEmailAddress_(message.getFrom());
    }
  } catch (err) {
    console.error('Unable to prefill sender: ' + err.message);
  }

  return [buildRuleManagerCard_(senderEmail)];
}

/* =========================================================
   MAIN CARD
   ========================================================= */

function buildRuleManagerCard_(prefillSender) {
  const card = CardService.newCardBuilder();
  
  const createSection = CardService.newCardSection()
    .setHeader('Create Rule');

  createSection.addWidget(
    CardService.newTextInput()
      .setFieldName('from')
      .setTitle('From')
      .setHint('sender@example.com')
      .setValue(prefillSender || '')
  );

  createSection.addWidget(
    CardService.newTextInput()
      .setFieldName('words')
      .setTitle('Has the words')
      /*.setHint('invoice, OTP, subject:report, etc.')*/
  );

  createSection.addWidget(buildLabelDropdown_('', ''));
  createSection.addWidget(buildDelayDropdown_('moveAfter', 'Move after', '10'));
  createSection.addWidget(buildDelayDropdown_('deleteAfter', 'Delete after', 'never'));

  createSection.addWidget(
    CardService.newSelectionInput()
      .setFieldName('applyExisting')
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .addItem(
        'Apply to existing emails',
        'yes',
        false
      )
  );

  createSection.addWidget(
    CardService.newTextButton()
      .setText('SAVE RULE')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction().setFunctionName('saveRuleFromCard')
      )
  );

  card.addSection(createSection);

  const rules = getRules_();
  const listSection = CardService.newCardSection().setHeader('Existing Rules');

  if (rules.length === 0) {
    listSection.addWidget(
      CardService.newTextParagraph().setText('No rules created yet.')
    );
  } else {
    rules.slice(0, CFG.MAX_RULES_ON_CARD).forEach(rule => {
      const conditionLines = [];
      if (rule.from) conditionLines.push('<b>From:</b> ' + escapeHtml_(rule.from));
      if (rule.words) conditionLines.push('<b>Has the words:</b> ' + escapeHtml_(rule.words));

      const description =
        conditionLines.join('<br>') +
        '<br><b>Move:</b> ' + formatDelay_(rule.moveAfter) +
        ' → ' + escapeHtml_(rule.destinationLabelName || 'No destination') +
        '<br><b>Delete:</b> ' + formatDelay_(rule.deleteAfter) +
        (rule.backfillPending ? '<br><i>Existing-mail enrollment pending</i>' : '');

      listSection.addWidget(
        CardService.newDecoratedText()
          .setText(description)
          .setWrapText(true)
      );

      const buttons = CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('EDIT')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('editRule')
                .setParameters({ ruleId: rule.id })
            )
        )
        .addButton(
          CardService.newTextButton()
            .setText('DELETE')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('deleteRuleFromCard')
                .setParameters({ ruleId: rule.id })
            )
        );

      listSection.addWidget(buttons);
    });

    if (rules.length > CFG.MAX_RULES_ON_CARD) {
      listSection.addWidget(
        CardService.newTextParagraph().setText(
          'Showing the first ' + CFG.MAX_RULES_ON_CARD + ' rules.'
        )
      );
    }
  }

 const automationSection = CardService.newCardSection();

const enabled = dailyTriggerExists_();

if (!enabled) {
  automationSection.addWidget(
    CardService.newTextButton()
      .setText('ENABLE DAILY PROCESSING')
      .setOnClickAction(
        CardService.newAction().setFunctionName('enableDailyProcessing')
      )
  );
}

automationSection.addWidget(
  CardService.newTextButton()
    .setText('RUN RULES NOW')
    .setOnClickAction(
      CardService.newAction().setFunctionName('runRulesNowFromCard')
    )
);

automationSection.addWidget(
  CardService.newTextButton()
    .setText('SHOW EXISTING RULES')
    .setOnClickOpenLinkAction(
      CardService.newAction()
        .setFunctionName('openExistingRulesPage')
    )
);

  card.addSection(automationSection);

  //card.addSection(listSection);

  return card.build();
}

/* =========================================================
   EDIT CARD
   ========================================================= */

function editRule(e) {
  const ruleId = getActionParameter_(e, 'ruleId');
  const rule = getRule_(ruleId);

  if (!rule) return notificationResponse_('Rule not found.');

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Edit Rule'));

  const section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('from')
      .setTitle('From')
      .setValue(rule.from || '')
  );

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('words')
      .setTitle('Has the words')
      .setValue(rule.words || '')
  );

  section.addWidget(
    buildLabelDropdown_(rule.destinationLabelId || '', rule.destinationLabelName || '')
  );

  section.addWidget(buildDelayDropdown_('moveAfter', 'Move after', rule.moveAfter));
  section.addWidget(buildDelayDropdown_('deleteAfter', 'Delete after', rule.deleteAfter));

  section.addWidget(
    CardService.newSelectionInput()
      .setFieldName('applyExisting')
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .addItem(
        'Also apply the edited rule to existing matching emails',
        'yes',
        false
      )
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('UPDATE RULE')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('updateRuleFromCard')
          .setParameters({ ruleId: rule.id })
      )
  );

  card.addSection(section);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

/* =========================================================
   CREATE RULE
   ========================================================= */

function saveRuleFromCard(e) {
  const input = readRuleForm_(e);

  try {
    validateRuleInput_(input);
    assertDestinationLabelExistsIfNeeded_(input);

    const id = Utilities.getUuid();
    const compactId = id.replace(/-/g, '');
    const trackingLabelName = CFG.INTERNAL_LABEL_PREFIX + 'TRACK_' + compactId;
    const movedLabelName = CFG.INTERNAL_LABEL_PREFIX + 'MOVED_' + compactId;

    let trackingLabel = null;
    let movedLabel = null;
    let filter = null;
    let ruleSaved = false;

    try {
      trackingLabel = createHiddenLabel_(trackingLabelName);
      movedLabel = createHiddenLabel_(movedLabelName);

      filter = createTrackingFilter_(input.from, input.words, trackingLabel.id);

      const destinationLabel =
        input.moveAfter !== 'never' && input.destinationLabelId
          ? Gmail.Users.Labels.get('me', input.destinationLabelId)
          : null;

      const rule = {
        id: id,
        from: input.from,
        words: input.words,
        destinationLabelId: destinationLabel ? destinationLabel.id : '',
        destinationLabelName: destinationLabel ? destinationLabel.name : '',
        moveAfter: input.moveAfter,
        deleteAfter: input.deleteAfter,
        trackingLabelId: trackingLabel.id,
        trackingLabelName: trackingLabel.name,
        movedLabelId: movedLabel.id,
        movedLabelName: movedLabel.name,
        filterId: filter.id,
        backfillPending: input.applyExisting,
        createdAt: new Date().toISOString()
      };

      saveRule_(rule);
      ruleSaved = true;

      let note = 'Rule saved.';

      try {
        ensureDailyTrigger_();
      } catch (triggerErr) {
        note += ' Daily trigger could not be enabled: ' + triggerErr.message;
      }

      if (input.applyExisting) {
        note += ' Existing matching email will be processed on the next daily run or when you press RUN RULES NOW.';
      }

      return refreshRootResponse_(note);

    } catch (err) {
      if (ruleSaved) deleteRuleProperty_(id);
      if (filter && filter.id) safeRemoveFilter_(filter.id);
      if (trackingLabel && trackingLabel.id) safeRemoveLabel_(trackingLabel.id);
      if (movedLabel && movedLabel.id) safeRemoveLabel_(movedLabel.id);
      throw err;
    }

  } catch (err) {
    return notificationResponse_(err.message || String(err));
  }
}

/* =========================================================
   UPDATE RULE
   ========================================================= */

function updateRuleFromCard(e) {
  const ruleId = getActionParameter_(e, 'ruleId');
  const oldRule = getRule_(ruleId);

  if (!oldRule) return notificationResponse_('Rule not found.');

  const input = readRuleForm_(e);

  try {
    validateRuleInput_(input);
    assertDestinationLabelExistsIfNeeded_(input);

    const destinationLabel =
      input.moveAfter !== 'never' && input.destinationLabelId
        ? Gmail.Users.Labels.get('me', input.destinationLabelId)
        : null;

    const criteriaChanged = input.from !== oldRule.from ||  
    input.words !== oldRule.words;
    
    let newFilter = {id: oldRule.filterId};
    if (criteriaChanged) {
        // Remove the old matching filter first.
        safeRemoveFilter_(oldRule.filterId, true);
        // Create the replacement filter using the same internal tracking label.
        newFilter = createTrackingFilter_(input.from, input.words,oldRule.trackingLabelId);
    }

    const updatedRule = Object.assign({}, oldRule, {
      from: input.from,
      words: input.words,
      destinationLabelId: destinationLabel ? destinationLabel.id : '',
      destinationLabelName: destinationLabel ? destinationLabel.name : '',
      moveAfter: input.moveAfter,
      deleteAfter: input.deleteAfter,
      filterId: newFilter.id,
      backfillPending: Boolean(oldRule.backfillPending || input.applyExisting),
      updatedAt: new Date().toISOString()
    });

    try {
      saveRule_(updatedRule);
    } catch (saveErr) {
      safeRemoveFilter_(newFilter.id);
      throw saveErr;
    }

    let note = 'Rule updated.';

    try {
      ensureDailyTrigger_();
    } catch (triggerErr) {
      note += ' Daily trigger could not be enabled: ' + triggerErr.message;
    }

    if (input.applyExisting) {
      note += ' Existing matching email will be processed on the next daily run or when you press RUN RULES NOW.';
    }

    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation()
          .popToRoot()
          .updateCard(buildRuleManagerCard_(''))
      )
      .setNotification(CardService.newNotification().setText(note))
      .setStateChanged(true)
      .build();

  } catch (err) {
    return notificationResponse_(err.message || String(err));
  }
}

/* =========================================================
   DELETE RULE
   ========================================================= */

function deleteRuleFromCard(e) {
  const ruleId = getActionParameter_(e, 'ruleId');
  const rule = getRule_(ruleId);

  if (!rule) return notificationResponse_('Rule not found.');

  try {
    // Stop future enrollment first. If this fails, keep the rule record so the
    // user can retry instead of leaving an active orphan filter.
    safeRemoveFilter_(rule.filterId, true);

    // Internal-label cleanup is best-effort. Once the filter is gone, a
    // leftover hidden label cannot enroll new mail.
    safeRemoveLabel_(rule.trackingLabelId, false);
    safeRemoveLabel_(rule.movedLabelId, false);
    deleteRuleProperty_(rule.id);

    return refreshRootResponse_('Rule deleted. Existing emails are left as they are.');
  } catch (err) {
    return notificationResponse_(err.message || String(err));
  }
}

function deleteRuleFromWeb(ruleId) {
  const rule = getRule_(ruleId);

  if (!rule) {
    throw new Error('Rule not found.');
  }

  // Stop future matching/enrollment.
  safeRemoveFilter_(rule.filterId, true);

  // Remove internal tracking labels.
  // Existing emails themselves are NOT deleted.
  safeRemoveLabel_(rule.trackingLabelId, false);
  safeRemoveLabel_(rule.movedLabelId, false);

  // Remove the saved rule.
  deleteRuleProperty_(rule.id);

  return {
    success: true,
    message: 'Rule deleted.'
  };
}


/* =========================================================
   WEB PAGE - EDIT RULE
   ========================================================= */

function getRuleEditorData(ruleId) {
  const rule = getRule_(ruleId);

  if (!rule) {
    throw new Error('Rule not found.');
  }

  const labels = getDestinationLabels_().map(label => ({
    id: label.id,
    name: label.name
  }));

  // If the rule points to a label that was later deleted,
  // keep it visible in the editor instead of silently losing it.
  if (
    rule.destinationLabelId &&
    !labels.some(label => label.id === rule.destinationLabelId)
  ) {
    labels.push({
      id: rule.destinationLabelId,
      name:
        '[Missing label] ' +
        (rule.destinationLabelName || rule.destinationLabelId)
    });
  }

  return {
    rule: {
      id: rule.id,
      from: rule.from || '',
      words: rule.words || '',
      destinationLabelId: rule.destinationLabelId || '',
      moveAfter: rule.moveAfter,
      deleteAfter: rule.deleteAfter
    },

    labels: labels
  };
}


function updateRuleFromWeb(input) {
  const ruleId = String(input.id || '');
  const oldRule = getRule_(ruleId);

  if (!oldRule) {
    throw new Error('Rule not found.');
  }

  const cleanInput = {
    from: String(input.from || '').trim(),
    words: String(input.words || '').trim(),
    destinationLabelId:
      String(input.destinationLabelId || '').trim(),
    moveAfter:
      normalizeDelay_(String(input.moveAfter || '10')),
    deleteAfter:
      normalizeDelay_(String(input.deleteAfter || 'never')),
    applyExisting:
      Boolean(input.applyExisting)
  };

  validateRuleInput_(cleanInput);
  assertDestinationLabelExistsIfNeeded_(cleanInput);

  const destinationLabel =
    cleanInput.moveAfter !== 'never' &&
    cleanInput.destinationLabelId
      ? Gmail.Users.Labels.get(
          'me',
          cleanInput.destinationLabelId
        )
      : null;

  const criteriaChanged =
    cleanInput.from !== oldRule.from ||
    cleanInput.words !== oldRule.words;

  let newFilterId = oldRule.filterId;
  let createdFilterId = null;

  /*
   * Only create a replacement Gmail filter if
   * From / Has the words actually changed.
   *
   * This prevents the:
   * "Filter already exists"
   * error you encountered earlier.
   */
  if (criteriaChanged) {
    const newFilter = createTrackingFilter_(
      cleanInput.from,
      cleanInput.words,
      oldRule.trackingLabelId
    );

    newFilterId = newFilter.id;
    createdFilterId = newFilter.id;
  }

  const updatedRule = Object.assign({}, oldRule, {
    from: cleanInput.from,
    words: cleanInput.words,

    destinationLabelId:
      destinationLabel ? destinationLabel.id : '',

    destinationLabelName:
      destinationLabel ? destinationLabel.name : '',

    moveAfter: cleanInput.moveAfter,
    deleteAfter: cleanInput.deleteAfter,

    filterId: newFilterId,

    backfillPending: Boolean(
      oldRule.backfillPending ||
      cleanInput.applyExisting
    ),

    updatedAt: new Date().toISOString()
  });

  try {
    saveRule_(updatedRule);
  } catch (err) {

    // If saving fails, remove only the newly-created filter.
    // The original Gmail filter remains untouched.
    if (createdFilterId) {
      safeRemoveFilter_(createdFilterId, false);
    }

    throw err;
  }

  let warning = '';

  /*
   * Once the new rule is safely stored,
   * remove the previous Gmail filter.
   */
  if (
    criteriaChanged &&
    oldRule.filterId &&
    oldRule.filterId !== newFilterId
  ) {
    try {
      safeRemoveFilter_(oldRule.filterId, true);
    } catch (err) {
      warning =
        ' Rule updated, but the old Gmail filter could not be removed automatically.';
    }
  }

  // Make sure the ONE daily processor exists.
  try {
    ensureDailyTrigger_();
  } catch (err) {
    warning +=
      ' Daily processing could not be enabled automatically.';
  }

  let message = 'Rule updated.' + warning;

  if (cleanInput.applyExisting) {
    message +=
      ' Existing matching emails will be processed on the next daily run or when you press RUN RULES NOW.';
  }

  return {
    success: true,
    message: message
  };
}

/* =========================================================
   FILTER / LABEL CREATION
   ========================================================= */

function createTrackingFilter_(from, words, trackingLabelId) {
  const criteria = { excludeChats: true };

  if (from) criteria.from = from;
  if (words) criteria.query = words;

  return Gmail.Users.Settings.Filters.create(
    {
      criteria: criteria,
      action: {
        addLabelIds: [trackingLabelId]
      }
    },
    'me'
  );
}

function createHiddenLabel_(name) {
  return Gmail.Users.Labels.create(
    {
      name: name,
      labelListVisibility: 'labelHide',
      messageListVisibility: 'hide'
    },
    'me'
  );
}

/* =========================================================
   APPLY RULE TO EXISTING MAIL
   ========================================================= */

function applyRuleToExisting_(rule) {
  let total = 0;

  // Always query only messages that have not been enrolled yet. This makes
  // the operation resumable if a long mailbox scan is interrupted.
  const query = buildExistingSearchQuery_(rule) +
    ' -label:' + rule.trackingLabelName;

  while (true) {
    const response = Gmail.Users.Messages.list('me', {
      q: query,
      maxResults: 500,
      includeSpamTrash: false
    });

    const messages = response.messages || [];
    if (messages.length === 0) break;

    Gmail.Users.Messages.batchModify(
      {
        ids: messages.map(message => message.id),
        addLabelIds: [rule.trackingLabelId]
      },
      'me'
    );

    total += messages.length;
  }

  return total;
}

function buildExistingSearchQuery_(rule) {
  const parts = [];

  if (rule.from) parts.push('from:(' + rule.from + ')');
  if (rule.words) parts.push('(' + rule.words + ')');

  // Keep the "existing" behavior aligned with incoming mail.
  parts.push('-in:sent', '-in:drafts', '-in:spam', '-in:trash');

  return parts.join(' ');
}

/* =========================================================
   DAILY PROCESSOR
   ========================================================= */

function processDelayedMailRules() {
  runProcessingWorker_();
}


function runProcessingWorker_() {
  const lock = LockService.getUserLock();

  if (!lock.tryLock(5000)) {
    console.log('Another Delayed Mail Rules worker is already running.');
    return;
  }

  try {
    let rules = getRules_();

    // Complete any requested "apply to existing" enrollment outside the
    // 30-second Gmail add-on callback limit.
    rules.forEach(rule => {
      if (!rule.backfillPending) return;

      try {
        const count = applyRuleToExisting_(rule);
        rule.backfillPending = false;
        rule.lastBackfillAt = new Date().toISOString();
        rule.lastBackfillCount = count;
        saveRule_(rule);
      } catch (err) {
        // Leave backfillPending=true so a later manual/daily run can resume.
        console.error('Backfill for rule ' + rule.id + ' failed: ' + err.message);
      }
    });

    rules = getRules_();
    const nowMs = Date.now();

    rules.forEach(rule => {
      try {
        processSingleRule_(rule, nowMs);
      } catch (err) {
        console.error('Rule ' + rule.id + ' failed: ' + err.message);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function processSingleRule_(rule, nowMs) {
  const messageIds = listTrackedMessageIds_(rule.trackingLabelId);

  messageIds.forEach(messageId => {
    try {
      processTrackedMessage_(messageId, rule, nowMs);
    } catch (err) {
      console.error(
        'Rule ' + rule.id + ', message ' + messageId + ' failed: ' + err.message
      );
    }
  });
}

function listTrackedMessageIds_(trackingLabelId) {
  const ids = [];
  let pageToken = null;

  do {
    const options = {
      labelIds: [trackingLabelId],
      maxResults: 500,
      includeSpamTrash: false
    };

    if (pageToken) options.pageToken = pageToken;

    const response = Gmail.Users.Messages.list('me', options);
    (response.messages || []).forEach(message => ids.push(message.id));
    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return ids;
}

function processTrackedMessage_(messageId, rule, nowMs) {
  const message = Gmail.Users.Messages.get(
    'me',
    messageId,
    {
      fields: 'id,labelIds,internalDate'
    }
  );

  const receivedMs = Number(message.internalDate);
  if (!Number.isFinite(receivedMs)) {
    throw new Error('Message has no usable internalDate.');
  }

  const ageMs = nowMs - receivedMs;
  const labels = message.labelIds || [];
  const movedAlready = labels.indexOf(rule.movedLabelId) !== -1;

  const moveDays = delayToNumber_(rule.moveAfter);
  const deleteDays = delayToNumber_(rule.deleteAfter);

  // Delete takes priority when both actions are due.
  if (deleteDays !== null && ageMs >= deleteDays * CFG.DAY_MS) {
    Gmail.Users.Messages.trash('me', messageId);

    // Cleanup is best-effort. The message is already in Trash, so it is no
    // longer returned by the normal tracking query even if cleanup fails.
    try {
      Gmail.Users.Messages.modify(
        {
          removeLabelIds: [rule.trackingLabelId, rule.movedLabelId]
        },
        'me',
        messageId
      );
    } catch (cleanupErr) {
      console.error('Tracking-label cleanup failed: ' + cleanupErr.message);
    }

    return;
  }

  if (moveDays === null) {
    return; // Waiting only for deletion.
  }

  if (movedAlready) {
    // If deletion was later changed to Never, no future action remains.
    if (deleteDays === null) {
      Gmail.Users.Messages.modify(
        {
          removeLabelIds: [rule.trackingLabelId, rule.movedLabelId]
        },
        'me',
        messageId
      );
    }
    return;
  }

  if (ageMs < moveDays * CFG.DAY_MS) {
    return;
  }

  if (deleteDays === null) {
    // Move is the final action. Remove the tracking label atomically.
    Gmail.Users.Messages.modify(
      {
        addLabelIds: [rule.destinationLabelId],
        removeLabelIds: ['INBOX', rule.trackingLabelId, rule.movedLabelId]
      },
      'me',
      messageId
    );
  } else {
    // Keep tracking for the later delete action and mark move as completed.
    Gmail.Users.Messages.modify(
      {
        addLabelIds: [rule.destinationLabelId, rule.movedLabelId],
        removeLabelIds: ['INBOX']
      },
      'me',
      messageId
    );
  }
}

/* =========================================================
   AUTOMATION
   ========================================================= */

function enableDailyProcessing() {
  try {
    ensureDailyTrigger_();
    return refreshRootResponse_('Daily processing enabled.');
  } catch (err) {
    return notificationResponse_(err.message || String(err));
  }
}

function ensureDailyTrigger_() {
  if (dailyTriggerExists_()) return;

  ScriptApp.newTrigger(CFG.TRIGGER_FUNCTION)
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
}

function dailyTriggerExists_() {
  return ScriptApp.getProjectTriggers().some(
    trigger => trigger.getHandlerFunction() === CFG.TRIGGER_FUNCTION
  );
}


function runRulesNowFromCard() {
  try {
    runProcessingWorker_();

    return refreshRootResponse_(
      'Rules processed.'
    );

  } catch (err) {
    return notificationResponse_(err.message || String(err));
  }
}

/* =========================================================
   RULE STORAGE - ONE PROPERTY PER RULE
   ========================================================= */

function saveRule_(rule) {
  PropertiesService.getUserProperties().setProperty(
    CFG.RULE_PREFIX + rule.id,
    JSON.stringify(rule)
  );
}

function getRule_(ruleId) {
  if (!ruleId) return null;

  const raw = PropertiesService.getUserProperties().getProperty(
    CFG.RULE_PREFIX + ruleId
  );

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function getRules_() {
  const properties = PropertiesService.getUserProperties().getProperties();
  const rules = [];

  Object.keys(properties).forEach(key => {
    if (key.indexOf(CFG.RULE_PREFIX) !== 0) return;

    try {
      rules.push(JSON.parse(properties[key]));
    } catch (err) {
      console.error('Ignoring invalid rule property ' + key);
    }
  });

  rules.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return rules;
}

function deleteRuleProperty_(ruleId) {
  PropertiesService.getUserProperties().deleteProperty(CFG.RULE_PREFIX + ruleId);
}

/* =========================================================
   LABEL DROPDOWN / VALIDATION
   ========================================================= */

function getDestinationLabels_() {
  const response = Gmail.Users.Labels.list('me');

  return (response.labels || [])
    .filter(label =>
      label.type === 'user' &&
      label.name.indexOf(CFG.INTERNAL_LABEL_PREFIX) !== 0
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function buildLabelDropdown_(selectedId, selectedName) {
  const labels = getDestinationLabels_();
  const selectedExists = selectedId && labels.some(label => label.id === selectedId);

  const input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle('Move to')
    .setFieldName('destinationLabelId');

  input.addItem('Select Gmail label', '', !selectedId);

  labels.forEach(label => {
    input.addItem(label.name, label.id, label.id === selectedId);
  });

  if (selectedId && !selectedExists) {
    input.addItem(
      '[Missing label] ' + (selectedName || selectedId),
      selectedId,
      true
    );
  }

  return input;
}

function buildDelayDropdown_(fieldName, title, selectedValue) {
  const input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle(title)
    .setFieldName(fieldName);

  DELAY_OPTIONS.forEach(option => {
    input.addItem(option.label, option.value, option.value === selectedValue);
  });

  return input;
}

function assertDestinationLabelExistsIfNeeded_(input) {
  if (input.moveAfter === 'never') return;

  try {
    const label = Gmail.Users.Labels.get('me', input.destinationLabelId);
    if (!label || label.type !== 'user') throw new Error('Invalid Gmail label.');
  } catch (err) {
    throw new Error('The selected destination label does not exist anymore.');
  }
}

/* =========================================================
   FORM / INPUT
   ========================================================= */

function readRuleForm_(e) {
  return {
    from: getFormValue_(e, 'from').trim(),
    words: getFormValue_(e, 'words').trim(),
    destinationLabelId: getFormValue_(e, 'destinationLabelId').trim(),
    moveAfter: normalizeDelay_(getFormValue_(e, 'moveAfter') || '10'),
    deleteAfter: normalizeDelay_(getFormValue_(e, 'deleteAfter') || 'never'),
    applyExisting: getFormValues_(e, 'applyExisting').indexOf('yes') !== -1
  };
}

function validateRuleInput_(input) {
  if (!input.from && !input.words) {
    throw new Error('Enter From, Has the words, or both.');
  }

  if (CFG.VALID_DELAYS.indexOf(input.moveAfter) === -1) {
    throw new Error('Invalid Move after value.');
  }

  if (CFG.VALID_DELAYS.indexOf(input.deleteAfter) === -1) {
    throw new Error('Invalid Delete after value.');
  }

  if (input.moveAfter !== 'never' && !input.destinationLabelId) {
    throw new Error('Select the Gmail label to move the message to.');
  }

  if (input.moveAfter === 'never' && input.deleteAfter === 'never') {
    throw new Error('Move after and Delete after cannot both be Never.');
  }
}

function getFormValue_(e, fieldName) {
  const values = getFormValues_(e, fieldName);
  return values.length ? String(values[0]) : '';
}

function getFormValues_(e, fieldName) {
  const common = e && e.commonEventObject ? e.commonEventObject : null;
  const formInputs = common && common.formInputs ? common.formInputs : {};
  const item = formInputs[fieldName];

  if (!item || !item.stringInputs || !item.stringInputs.value) return [];
  return item.stringInputs.value;
}

function getActionParameter_(e, name) {
  if (
    e &&
    e.commonEventObject &&
    e.commonEventObject.parameters &&
    e.commonEventObject.parameters[name] !== undefined
  ) {
    return String(e.commonEventObject.parameters[name]);
  }

  // Compatibility fallback for older action event objects.
  if (e && e.parameters && e.parameters[name] !== undefined) {
    return String(e.parameters[name]);
  }

  return '';
}

/* =========================================================
   SAFE RESOURCE CLEANUP
   Gmail Advanced Service exposes REST "delete" methods as
   "remove" in Apps Script because delete is a JS keyword.
   ========================================================= */

function safeRemoveFilter_(filterId, throwOnFailure) {
  if (!filterId) return;

  try {
    Gmail.Users.Settings.Filters.remove('me', filterId);
  } catch (err) {
    if (isNotFoundError_(err)) return;
    if (throwOnFailure) throw err;
    console.error('Filter cleanup failed: ' + err.message);
  }
}

function safeRemoveLabel_(labelId, throwOnFailure) {
  if (!labelId) return;

  try {
    Gmail.Users.Labels.remove('me', labelId);
  } catch (err) {
    if (isNotFoundError_(err)) return;
    if (throwOnFailure) throw err;
    console.error('Label cleanup failed: ' + err.message);
  }
}

function isNotFoundError_(err) {
  return /404|not found|requested entity was not found/i.test(String(err));
}

/* =========================================================
   CARD RESPONSES
   ========================================================= */

function refreshRootResponse_(message) {
  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().updateCard(buildRuleManagerCard_(''))
    )
    .setNotification(CardService.newNotification().setText(message))
    .setStateChanged(true)
    .build();
}

function notificationResponse_(message) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(message))
    .build();
}

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeDelay_(value) {
  const text = String(value || '').toLowerCase().trim();
  if (text === 'never') return 'never';
  return String(parseInt(text, 10));
}

function delayToNumber_(value) {
  return value === 'never' ? null : Number(value);
}

function formatDelay_(value) {
  return value === 'never' ? 'Never' : escapeHtml_(value) + ' days';
}

function extractEmailAddress_(fromText) {
  if (!fromText) return '';

  const bracketMatch = String(fromText).match(/<([^>]+)>/);
  if (bracketMatch) return bracketMatch[1].trim();

  const plainMatch = String(fromText).match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );

  return plainMatch ? plainMatch[0] : String(fromText).trim();
}

function escapeHtml_(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =========================================================
   EXISTING RULES WEB PAGE
   ========================================================= */

function doGet() {
  return HtmlService
    .createTemplateFromFile('Rules')
    .evaluate()
    .setTitle('Mail Filter - Existing Rules');
}


function getRulesForWeb() {
  return getRules_().map(rule => {

    const moveText =
      rule.moveAfter === 'never'
        ? 'Never'
        : rule.moveAfter + ' days → ' +
          (rule.destinationLabelName || '—');

    const deleteText =
      rule.deleteAfter === 'never'
        ? 'Never'
        : rule.deleteAfter + ' days';

    return {
      id: rule.id,
      from: rule.from || '',
      words: rule.words || '',
      moveText: moveText,
      deleteText: deleteText
    };
  });
}



function openExistingRulesPage() {

  const url = PropertiesService
    .getScriptProperties()
    .getProperty('WEB_APP_URL');

  if (!url) {
    throw new Error(
      'WEB_APP_URL is not configured in Script Properties.'
    );
  }

  return CardService.newActionResponseBuilder()
    .setOpenLink(
      CardService.newOpenLink()
        .setUrl(url)
        .setOpenAs(CardService.OpenAs.FULL_SIZE)
        .setOnClose(CardService.OnClose.NOTHING)
    )
    .build();
}
