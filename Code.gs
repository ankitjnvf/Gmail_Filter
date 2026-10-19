const CFG = Object.freeze({
  RULE_PREFIX: 'MR_RULE_',
  INTERNAL_LABEL_PREFIX: 'ZZ_',
  TRIGGER_FUNCTION: 'processDelayedMailRules',
  VALID_DELAYS: ['1', '5', '10', '50', '100', 'never'],
  EXECUTION_HISTORY_DAYS: 10,
  EXECUTION_LOG_KEY: 'MR_EXECUTION_LOG',
  AUTOMATION_HEALTH_KEY: 'MR_AUTOMATION_HEALTH',
  EXECUTION_STALE_MS: 15 * 60 * 1000,
  WORKER_RUNTIME_BUDGET_MS: 5 * 60 * 1000,
  MANUAL_RUNTIME_BUDGET_MS: 20 * 1000,
  MESSAGE_THROTTLE_MS: 500,
  QUOTA_RETRY_WAIT_MS: 15000,
  DAY_MS: 24 * 60 * 60 * 1000

});
const DELAY_OPTIONS = Object.freeze([
  { label: '1 day', value: '1' },
  { label: '5 days', value: '5' },
  { label: '10 days', value: '10' },
  { label: '50 days', value: '50' },
  { label: '100 days', value: '100' },
  { label: 'Never', value: 'never' }
]);

/* =========================================================
   GMAIL ADD-ON ENTRY POINTS
   \\\\========================================================= */

function onHomePage(e) {
  hideExistingInternalLabelsOnce_();
  return [buildRuleManagerCard_('')];
}

function onGmailMessageOpen(e) {
  hideExistingInternalLabelsOnce_();
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
   \\\\========================================================= */

function buildRuleManagerCard_(prefillSender, formState) {
  const state = formState || {};
  const fromValue =
    state.from !== undefined
      ? String(state.from)
      : (prefillSender || '');
  const wordsValue =
    state.words !== undefined
      ? String(state.words)
      : '';
  const destinationLabelId =
    state.destinationLabelId !== undefined
      ? String(state.destinationLabelId)
      : '';
  const moveAfter =
    state.moveAfter !== undefined
      ? normalizeDelay_(state.moveAfter)
      : '10';
  const deleteAfter =
    state.deleteAfter !== undefined
      ? normalizeDelay_(state.deleteAfter)
      : 'never';
  const applyExisting =
    Boolean(state.applyExisting);
  const removePreviousLabels =
    Boolean(state.removePreviousLabels);
  const hasAttachment =
    Boolean(state.hasAttachment);
  const matchCount =
    countExistingMatchingMessages_({
      from: fromValue.trim(),
      words: wordsValue.trim(),
      hasAttachment: hasAttachment
    });
  const card = CardService.newCardBuilder();
  const createSection =
    CardService.newCardSection()
      /*.setHeader('Create Rule');*/
  createSection.addWidget(
    CardService.newTextInput()
      .setFieldName('from')
      .setTitle('From')
      /*.setHint('sender@example.com')*/
      .setValue(fromValue)
      .setOnChangeAction(
        CardService.newAction()
          .setFunctionName(
            'refreshCreateMatchCount'
          )
      )
  );
  createSection.addWidget(
    CardService.newTextInput()
      .setFieldName('words')
      .setTitle('Has the words')
      .setValue(wordsValue)
      .setOnChangeAction(
        CardService.newAction()
          .setFunctionName(
            'refreshCreateMatchCount'
          )
      )
  );
  createSection.addWidget(
    CardService.newSelectionInput()
      .setFieldName('hasAttachment')
      .setType(
        CardService.SelectionInputType.CHECK_BOX
      )
      .addItem(
        'Has Attachment',
        'yes',
        hasAttachment
      )
      .setOnChangeAction(
        CardService.newAction()
          .setFunctionName(
            'refreshCreateMatchCount'
          )
      )
  );
  createSection.addWidget(
    CardService.newDecoratedText()
      .setText(
        '<b>Matching existing emails:</b> ' +
        escapeHtml_(String(matchCount))
      )
      .setWrapText(true)
  );
  createSection.addWidget(
    buildLabelDropdown_(
      destinationLabelId,
      ''
    )
  );
  createSection.addWidget(
    buildDelayDropdown_(
      'moveAfter',
      'Move after',
      moveAfter
    )
  );
  createSection.addWidget(
    buildDelayDropdown_(
      'deleteAfter',
      'Delete after',
      deleteAfter
    )
  );
  createSection.addWidget(
    CardService.newSelectionInput()
      .setFieldName('applyExisting')
      .setType(
        CardService.SelectionInputType.CHECK_BOX
      )
      .addItem(
        'Apply to existing emails',
        'yes',
        applyExisting
      )
  );
  createSection.addWidget(
    CardService.newSelectionInput()
      .setFieldName(
        'removePreviousLabels'
      )
      .setType(
        CardService.SelectionInputType.CHECK_BOX
      )
      .addItem(
        'Remove previous labels',
        'yes',
        removePreviousLabels
      )
  );
  createSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText('SAVE')
          .setTextButtonStyle(
            CardService.TextButtonStyle.FILLED
          )
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName(
                'saveRuleFromCard'
              )
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText('RUN NOW')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName(
                'runRulesNowFromCard'
              )
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText('RULES')
          .setOnClickOpenLinkAction(
            CardService.newAction()
              .setFunctionName(
                'openExistingRulesPage'
              )
          )
      )
  );
  card.addSection(createSection);
  const automationSection =
    CardService.newCardSection()
      /*.setHeader('Automation Status');*/
  const automationStatus =
    getAutomationStatus_();
  automationSection.addWidget(
    CardService.newDecoratedText()
      .setText(
        '<b>Next:</b> ' +
        escapeHtml_(
          automationStatus.nextExpectedText
        ) +
        '<br><b>Backfill:</b> ' +
        escapeHtml_(
          String(
            automationStatus.backfillPendingCount
          )
        ) +
        ' • <b>Tracked:</b> ' +
        escapeHtml_(
          automationStatus.trackedAtLastRunCompactText
        )
      )
      .setWrapText(true)
  );
  const enabled =
    automationStatus.enabled;
  if (!enabled) {
    automationSection.addWidget(
      CardService.newTextButton()
        .setText(
          'ENABLE DAILY PROCESSING'
        )
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(
              'enableDailyProcessing'
            )
        )
    );
  }
  card.addSection(automationSection);
  const recentExecutionsSection =
    CardService.newCardSection()
      .setHeader('Recent Executions');
  const recentExecutions =
  getExecutionHistory_()
    .slice(0, 3);
if (
  recentExecutions.length === 0
) {
  recentExecutionsSection.addWidget(
    CardService.newTextParagraph()
      .setText(
        'No executions recorded yet.'
      )
  );
} else {
  recentExecutions.forEach(
    entry => {
      const text =
        '<b>' +
        escapeHtml_(
          formatExecutionTime_(
            entry.startedAt
          )
        ) +
        '</b> — ' +
        escapeHtml_(
          entry.status ||
          'Unknown'
        );
      recentExecutionsSection
        .addWidget(
          CardService
            .newDecoratedText()
            .setText(text)
            .setWrapText(true)
        );
    }
  );
}
  card.addSection(
    recentExecutionsSection
  );
  const developerSection =
    CardService.newCardSection();
  developerSection.addWidget(
    CardService.newTextParagraph()
      .setText(
        'Developed by Ankit Yadav • ' +
        '<a href="https://www.linkedin.com/in/ankit-jnvf/">LinkedIn</a>'
      )
  );
  card.addSection(
    developerSection
  );
  return card.build();
}

function refreshCreateMatchCount(e) {
  const input =
    readRuleForm_(e);
  return CardService
    .newActionResponseBuilder()
    .setNavigation(
      CardService
        .newNavigation()
        .updateCard(
          buildRuleManagerCard_(
            '',
            input
          )
        )
    )
    .build();
}

/* =========================================================
   CREATE RULE
   \\\\========================================================= */

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
      filter = createTrackingFilter_(input.from, input.words, input.hasAttachment, trackingLabel.id);
      const destinationLabel =
        input.moveAfter !== 'never' && input.destinationLabelId
          ? Gmail.Users.Labels.get('me', input.destinationLabelId)
          : null;
      const rule = {
        id: id,
        from: input.from,
        words: input.words,
        hasAttachment: input.hasAttachment,
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
        removePreviousLabels: input.removePreviousLabels,
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
   DELETE RULE
   \\\\========================================================= */


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
   \\\\========================================================= */

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
      hasAttachment: Boolean(rule.hasAttachment),
      destinationLabelId: rule.destinationLabelId || '',
      moveAfter: rule.moveAfter,
      deleteAfter: rule.deleteAfter,
      removePreviousLabels: Boolean(rule.removePreviousLabels)
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
    hasAttachment:
      Boolean(input.hasAttachment),
    destinationLabelId:
      String(input.destinationLabelId || '').trim(),
    moveAfter:
      normalizeDelay_(String(input.moveAfter || '10')),
    deleteAfter:
      normalizeDelay_(String(input.deleteAfter || 'never')),
    applyExisting:
      Boolean(input.applyExisting),
    removePreviousLabels:
      Boolean(input.removePreviousLabels)
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
    cleanInput.words !== oldRule.words ||
    Boolean(cleanInput.hasAttachment) !== Boolean(oldRule.hasAttachment);
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
      cleanInput.hasAttachment,
      oldRule.trackingLabelId
    );
    newFilterId = newFilter.id;
    createdFilterId = newFilter.id;
  }
  const updatedRule = Object.assign({}, oldRule, {
    from: cleanInput.from,
    words: cleanInput.words,
    hasAttachment:
      cleanInput.hasAttachment,
    destinationLabelId:
      destinationLabel ? destinationLabel.id : '',
    destinationLabelName:
      destinationLabel ? destinationLabel.name : '',
    moveAfter: cleanInput.moveAfter,
    deleteAfter: cleanInput.deleteAfter,
    removePreviousLabels:
    cleanInput.removePreviousLabels,
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
   \\\\========================================================= */

function createTrackingFilter_(
  from,
  words,
  hasAttachment,
  trackingLabelId
) {
  const criteria = { excludeChats: true };
  if (from) criteria.from = from;
  if (words) criteria.query = words;
  if (hasAttachment) {
    criteria.hasAttachment = true;
  }
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

function hideExistingInternalLabelsOnce_() {
  const props = PropertiesService.getUserProperties();
  const marker = 'MR_INTERNAL_LABELS_HIDDEN_V1';
  if (props.getProperty(marker) === 'done') {
    return;
  }
  const response = Gmail.Users.Labels.list('me');
  const labels = response.labels || [];
  labels.forEach(label => {
    if (
      label.type === 'user' &&
      label.name &&
      label.name.indexOf(CFG.INTERNAL_LABEL_PREFIX) === 0
    ) {
      try {
        Gmail.Users.Labels.patch(
          {
            labelListVisibility: 'labelHide',
            messageListVisibility: 'hide'
          },
          'me',
          label.id
        );
      } catch (err) {
        console.error(
          'Unable to hide internal label ' +
          label.name +
          ': ' +
          err.message
        );
      }
    }
  });
  props.setProperty(marker, 'done');
}

/* =========================================================
   APPLY RULE TO EXISTING MAIL
   \\\\========================================================= */

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

function countExistingMatchingMessages_(rule) {
  if (
    !rule ||
    (
      !String(
        rule.from || ''
      ).trim() &&
      !String(
        rule.words || ''
      ).trim()
    )
  ) {
    return 0;
  }
  let total = 0;
  let pageToken = null;
  const query =
    buildExistingSearchQuery_(rule);
  do {
    const options = {
      q: query,
      maxResults: 500,
      includeSpamTrash: false
    };
    if (pageToken) {
      options.pageToken =
        pageToken;
    }
    const response =
      Gmail.Users.Messages.list(
        'me',
        options
      );
    total +=
      (
        response.messages ||
        []
      ).length;
    pageToken =
      response.nextPageToken ||
      null;
  } while (pageToken);
  return total;
}

function buildExistingSearchQuery_(rule) {
  const parts = [];
  if (rule.from) parts.push('from:(' + rule.from + ')');
  if (rule.words) parts.push('(' + rule.words + ')');
  if (rule.hasAttachment) {
    parts.push('has:attachment');
  }
  // Keep the "existing" behavior aligned with incoming mail.
  parts.push('-in:sent', '-in:drafts', '-in:spam', '-in:trash');
  return parts.join(' ');
}

function hasRuleMatchedWithinLastYear_(rule) {
  const oneYearAgoMs =
    Date.now() - (365 * CFG.DAY_MS);
  const createdAtMs =
    new Date(rule.createdAt || '').getTime();
  // A new rule remains green during its first year,
  // even if it has not matched an email yet.
  if (
    !isNaN(createdAtMs) &&
    createdAtMs >= oneYearAgoMs
  ) {
    return true;
  }
  const query =
    buildExistingSearchQuery_(rule) +
    ' newer_than:1y';
  const response =
    Gmail.Users.Messages.list(
      'me',
      {
        q: query,
        maxResults: 1,
        includeSpamTrash: false
      }
    );
  return Boolean(
    response.messages &&
    response.messages.length > 0
  );
}

/* =========================================================
   DAILY PROCESSOR
   \\\\========================================================= */

function processDelayedMailRules() {
  runProcessingWorker_('Daily');
}

function runProcessingWorker_(runType, runtimeBudgetMs) {
  const workerStartedAtMs = Date.now();
  const effectiveRuntimeBudgetMs =
    Number(runtimeBudgetMs) > 0
      ? Number(runtimeBudgetMs)
      : CFG.WORKER_RUNTIME_BUDGET_MS;
  const workerDeadlineMs =
    workerStartedAtMs +
    effectiveRuntimeBudgetMs;
  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    console.log('Another Delayed Mail Rules worker is already running.');
    return;
  }
  let executionId = '';
  try {
    executionId = startExecutionRecord_(runType || 'Unknown');
    let rules = getRules_();
    const executionErrors = [];
    let workerStoppedEarly = false;
    for (const rule of rules) {
  if (Date.now() >= workerDeadlineMs) {
    workerStoppedEarly = true;
    console.log(
      'Worker stopped cleanly before runtime limit during backfill.'
    );
    break;
  }
  if (!rule.backfillPending) continue;
  try {
    const count =
      applyRuleToExisting_(rule);
      rule.backfillPending = false;
      rule.lastBackfillAt =
      new Date().toISOString();
      rule.lastBackfillCount = count;
      saveRule_(rule);
  } catch (err) {
    const message =
      'Backfill for rule ' +
      rule.id +
      ' failed: ' +
      err.message;
    console.error(message);
    executionErrors.push(message);
  }
}
    rules = getRules_();
    const nowMs = Date.now();
    let trackedAtRunCount = 0;
    for (const rule of rules) {
      if (Date.now() >= workerDeadlineMs) {
        workerStoppedEarly = true;
        console.log(
        'Worker stopped cleanly before runtime limit during rule processing.'
        );
        break;
      }
      try {
        const ruleResult =
  processSingleRule_(
    rule,
    nowMs,
    workerDeadlineMs
  );
trackedAtRunCount +=
  ruleResult.trackedCount;
ruleResult.errors.forEach(
  error => executionErrors.push(error)
);
if (ruleResult.stoppedEarly) {
  workerStoppedEarly = true;
  console.log(
    'Worker stopped cleanly during rule ' +
    rule.id +
    ' before runtime limit.'
  );
  break;
}
      }
      catch (err) {
        const message =      'Rule ' +    rule.id +  ' failed: ' + err.message;
        console.error(message);
        executionErrors.push(message);
      }
    }
    let finalStatus =
      executionErrors.length > 0 ? 'Failure' : 'Success';
    let executionNote = '';

    if (
      (runType || 'Unknown') === 'Manual' &&
      workerStoppedEarly &&
      executionErrors.length === 0
    ) {
      finalStatus = 'Partial';
      executionNote =
        'Manual run time limit reached. Remaining messages deferred to the next scheduled run.';
    }

    if (executionErrors.length > 0) {
      completeExecutionRecord_(
        executionId,
        'Failure',
        executionErrors.slice(0, 3).join(' | ')
      );
    } else {
      completeExecutionRecord_(
        executionId,
        finalStatus,
        executionNote
      );
    }

    saveAutomationHealthSnapshot_({
      lastRunAt: new Date().toISOString(),
      lastRunType: runType || 'Unknown',
      lastRunStatus: finalStatus,
      trackedAtRunCount: trackedAtRunCount
    });

    return {
      status: finalStatus,
      stoppedEarly: workerStoppedEarly,
      trackedCount: trackedAtRunCount,
      error:
        executionErrors.length > 0
          ? executionErrors.slice(0, 3).join(' | ')
          : ''
    };
  } catch (err) {
    if (executionId) {
      completeExecutionRecord_(
        executionId,
        'Failure',
        err.message || String(err)
      );
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function processSingleRule_(rule, nowMs, workerDeadlineMs) {
  const messageIds = listTrackedMessageIds_(rule.trackingLabelId);
  const errors = [];
  let processedCount = 0;
  let stoppedEarly = false;
  const ordinaryUserLabelIds =
    rule.removePreviousLabels
      ? getOrdinaryUserLabelIds_()
      : [];
  for (const messageId of messageIds) {
    if (
      workerDeadlineMs &&
      Date.now() >= workerDeadlineMs
    ) {
      stoppedEarly = true;
      break;
    }
    try {
  processTrackedMessage_(
    messageId,
    rule,
    nowMs,
    ordinaryUserLabelIds
  );

} catch (err) {

  const errorText =
    err && err.message
      ? err.message
      : String(err);

  const isQuotaError =
    /quota exceeded|rate limit|user-rate limit/i.test(
      errorText
    );

  if (isQuotaError) {

    if (
      workerDeadlineMs &&
      Date.now() +
        CFG.QUOTA_RETRY_WAIT_MS >=
        workerDeadlineMs
    ) {
      stoppedEarly = true;
      break;
    }

    Utilities.sleep(
      CFG.QUOTA_RETRY_WAIT_MS
    );

    try {

      processTrackedMessage_(
        messageId,
        rule,
        nowMs,
        ordinaryUserLabelIds
      );

    } catch (retryErr) {

      const message =
        'Rule ' +
        rule.id +
        ', message ' +
        messageId +
        ' failed: ' +
        (
          retryErr &&
          retryErr.message
            ? retryErr.message
            : String(retryErr)
        );

      console.error(message);
      errors.push(message);

    }

  } else {

    const message =
      'Rule ' +
      rule.id +
      ', message ' +
      messageId +
      ' failed: ' +
      errorText;

    console.error(message);
    errors.push(message);

  }

}

processedCount++;

if (
  CFG.MESSAGE_THROTTLE_MS > 0
) {
  Utilities.sleep(
    CFG.MESSAGE_THROTTLE_MS
  );
}
  }
  return {
    errors: errors,
    trackedCount: processedCount,
    stoppedEarly: stoppedEarly
  };
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
    (response.messages || []).forEach(
      message => ids.push(message.id)
    );
    pageToken = response.nextPageToken || null;
  } while (pageToken);
  return ids;
}

function processTrackedMessage_(messageId, rule, nowMs, ordinaryUserLabelIds) {
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
  const previousUserLabelIds =
  rule.removePreviousLabels
    ? getPreviousUserLabelIdsToRemove_(
        labels,
        ordinaryUserLabelIds,
        rule.destinationLabelId
      )
    : [];
  if (deleteDays === null) {
  // Move is the final action.
  // Remove ordinary previous user labels if requested,
  // along with the internal tracking labels.
  Gmail.Users.Messages.modify(
    {
      addLabelIds: [rule.destinationLabelId],
      removeLabelIds: [
        'INBOX',
        rule.trackingLabelId,
        rule.movedLabelId
      ].concat(previousUserLabelIds)
    },
    'me',
    messageId
  );
} else {
  // Keep MR tracking for the later delete action.
  // Remove only ordinary previous user labels.
  Gmail.Users.Messages.modify(
    {
      addLabelIds: [
        rule.destinationLabelId,
        rule.movedLabelId
      ],
      removeLabelIds: [
        'INBOX'
      ].concat(previousUserLabelIds)
    },
    'me',
    messageId
  );
}
}

/* =========================================================
   RECENT EXECUTIONS
   \\\\========================================================= */

function getExecutionHistory_() {
  const props = PropertiesService.getUserProperties();
  const raw = props.getProperty(CFG.EXECUTION_LOG_KEY);
  let history = [];
  if (raw) {
    try {
      history = JSON.parse(raw);
      if (!Array.isArray(history)) history = [];
    } catch (err) {
      history = [];
    }
  }
  const nowMs = Date.now();
  const cutoffMs =
    nowMs -
    CFG.EXECUTION_HISTORY_DAYS *
    CFG.DAY_MS;
  let changed = false;
  history.forEach(entry => {
    if (
      entry.status === 'Running' &&
      entry.startedAt &&
      nowMs - new Date(entry.startedAt).getTime() >= CFG.EXECUTION_STALE_MS
    ) {
      entry.status = 'Interrupted';
      entry.endedAt = new Date().toISOString();
      entry.error =
        entry.error || 'Execution did not complete normally.';
      changed = true;
    }
  });
  const originalLength = history.length;
  history = history
    .filter(entry => {
      if (!entry.startedAt) return false;
      const startedAtMs =
        new Date(entry.startedAt).getTime();
      return (
        !isNaN(startedAtMs) &&
        startedAtMs >= cutoffMs
      );
    })
    .sort((a, b) =>
      String(b.startedAt || '').localeCompare(
        String(a.startedAt || '')
      )
    );
  if (history.length !== originalLength) {
    changed = true;
  }
  if (changed) {
    props.setProperty(
      CFG.EXECUTION_LOG_KEY,
      JSON.stringify(history)
    );
  }
  return history;
}

function saveExecutionHistory_(history) {
  const cutoffMs =
    Date.now() -
    CFG.EXECUTION_HISTORY_DAYS *
    CFG.DAY_MS;
  const retainedHistory =
    (history || [])
      .filter(entry => {
        if (!entry.startedAt) return false;
        const startedAtMs =
          new Date(entry.startedAt).getTime();
        return (
          !isNaN(startedAtMs) &&
          startedAtMs >= cutoffMs
        );
      })
      .sort((a, b) =>
        String(b.startedAt || '').localeCompare(
          String(a.startedAt || '')
        )
      );
  PropertiesService.getUserProperties().setProperty(
    CFG.EXECUTION_LOG_KEY,
    JSON.stringify(retainedHistory)
  );
}

function startExecutionRecord_(runType) {
  const history = getExecutionHistory_();
  const id = Utilities.getUuid();
  history.unshift({
    id: id,
    runType: runType || 'Unknown',
    status: 'Running',
    startedAt: new Date().toISOString(),
    endedAt: '',
    error: ''
  });
  saveExecutionHistory_(history);
  return id;
}

function completeExecutionRecord_(executionId, status, errorText) {
  if (!executionId) return;
  const history = getExecutionHistory_();
  const entry = history.find(item => item.id === executionId);
  if (!entry) return;
  entry.status = status || 'Failure';
  entry.endedAt = new Date().toISOString();
  entry.error = errorText || '';
  saveExecutionHistory_(history);
}

function formatExecutionTimeCompact_(isoText) {
  if (!isoText) return 'Unknown time';
  const date = new Date(isoText);
  if (isNaN(date.getTime())) return 'Unknown time';
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'MMM d, h:mm a'
  );
}

function formatExecutionTime_(isoText) {
  if (!isoText) return 'Unknown time';
  const date = new Date(isoText);
  if (isNaN(date.getTime())) return 'Unknown time';
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'MMM d, yyyy h:mm a'
  );
}

/* =========================================================
   AUTOMATION STATUS
   \\========================================================= */

function getAutomationStatus_() {
  const enabled = dailyTriggerExists_();
  const rules = getRules_();
  const backfillPendingCount =
    rules.filter(rule => Boolean(rule.backfillPending)).length;
  const history = getExecutionHistory_();
  const lastRun = history.length ? history[0] : null;
  const snapshot = getAutomationHealthSnapshot_();
  let lastRunText = 'No recorded run';
  if (lastRun) {
    lastRunText =
      formatExecutionTime_(lastRun.startedAt) +
      ' — ' +
      (lastRun.runType || 'Unknown') +
      ' — ' +
      (lastRun.status || 'Unknown');
  }
  return {
    enabled: enabled,
    lastRunText: lastRunText,
    nextExpectedText:
      enabled
        ? getNextExpectedDailyRunText_(history)
        : 'Not scheduled',
    backfillPendingCount: backfillPendingCount,
    trackedAtLastRunText:
      snapshot &&
      Number.isFinite(Number(snapshot.trackedAtRunCount))
        ? String(Number(snapshot.trackedAtRunCount)) + ' message(s)'
        : 'Not recorded yet',
    trackedAtLastRunCompactText:
      snapshot &&
      Number.isFinite(Number(snapshot.trackedAtRunCount))
        ? String(Number(snapshot.trackedAtRunCount))
        : '—'
  };
}

function getAutomationHealthSnapshot_() {
  const raw = PropertiesService
    .getUserProperties()
    .getProperty(CFG.AUTOMATION_HEALTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveAutomationHealthSnapshot_(snapshot) {
  PropertiesService
    .getUserProperties()
    .setProperty(
      CFG.AUTOMATION_HEALTH_KEY,
      JSON.stringify(snapshot || {})
    );
}

function getNextExpectedDailyRunText_(history) {
  const timeZone = Session.getScriptTimeZone();
  const now = new Date();
  const currentHour = Number(
    Utilities.formatDate(now, timeZone, 'H')
  );
  const todayKey =
    Utilities.formatDate(now, timeZone, 'yyyy-MM-dd');
  const dailyRanToday = (history || []).some(entry => {
    if (
      entry.runType !== 'Daily' ||
      !entry.startedAt
    ) {
      return false;
    }
    const date = new Date(entry.startedAt);
    if (isNaN(date.getTime())) return false;
    return (
      Utilities.formatDate(
        date,
        timeZone,
        'yyyy-MM-dd'
      ) === todayKey
    );
  });
  if (currentHour < 2) {
    return 'Today, 2–3 AM';
  }
  if (
    currentHour === 2 &&
    !dailyRanToday
  ) {
    return 'Today, 2–3 AM';
  }
  return 'Tomorrow, 2–3 AM';
}

/* =========================================================
   AUTOMATION
   \\\\========================================================= */

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

    const result =
      runProcessingWorker_(
        'Manual',
        CFG.MANUAL_RUNTIME_BUDGET_MS
      );

    if (
      result &&
      result.status === 'Partial'
    ) {
      return refreshRootResponse_(
        'Manual run reached its short time limit. ' +
        'Remaining messages will be processed automatically during the next scheduled run.'
      );
    }

    if (
      result &&
      result.status === 'Failure'
    ) {
      return refreshRootResponse_(
        'Manual run completed with errors. ' +
        'Check Recent Executions or Existing Rules for details.'
      );
    }

    return refreshRootResponse_(
      'Manual run completed. ' +
      'All currently tracked messages were processed within the manual-run time limit.'
    );

  } catch (err) {

    return notificationResponse_(
      err.message || String(err)
    );

  }

}

/* =========================================================
   RULE STORAGE - ONE PROPERTY PER RULE
   \\\\========================================================= */

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
   \\\\========================================================= */

function getOrdinaryUserLabelIds_() {
  const response = Gmail.Users.Labels.list('me');
  return (response.labels || [])
    .filter(label =>
      label.type === 'user' &&
      label.name &&
      label.name.indexOf(CFG.INTERNAL_LABEL_PREFIX) !== 0
    )
    .map(label => label.id);
}

function getPreviousUserLabelIdsToRemove_(
  messageLabelIds,
  ordinaryUserLabelIds,
  destinationLabelId
) {
  const currentLabelIds = new Set(messageLabelIds || []);
  return ordinaryUserLabelIds.filter(labelId =>
    labelId !== destinationLabelId &&
    currentLabelIds.has(labelId)
  );
}

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
   \\\\========================================================= */

function readRuleForm_(e) {
  return {
    from: getFormValue_(e, 'from').trim(),
    words: getFormValue_(e, 'words').trim(),
    hasAttachment:
      getFormValues_(e, 'hasAttachment').indexOf('yes') !== -1,
    destinationLabelId: getFormValue_(e, 'destinationLabelId').trim(),
    moveAfter: normalizeDelay_(getFormValue_(e, 'moveAfter') || '10'),
    deleteAfter: normalizeDelay_(getFormValue_(e, 'deleteAfter') || 'never'),
    applyExisting:
      getFormValues_(e, 'applyExisting').indexOf('yes') !== -1,
    removePreviousLabels:
      getFormValues_(e, 'removePreviousLabels').indexOf('yes') !== -1
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


/* =========================================================
   SAFE RESOURCE CLEANUP
   Gmail Advanced Service exposes REST "delete" methods as
   "remove" in Apps Script because delete is a JS keyword.
   \\\\========================================================= */

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
   \\\\========================================================= */

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
   \\\\========================================================= */

function normalizeDelay_(value) {
  const text = String(value || '').toLowerCase().trim();
  if (text === 'never') return 'never';
  return String(parseInt(text, 10));
}

function delayToNumber_(value) {
  return value === 'never' ? null : Number(value);
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
   \\\\========================================================= */

function doGet() {
  return HtmlService
    .createTemplateFromFile('Rules')
    .evaluate()
    .setTitle('Mail Filter - Existing Rules');
}


function getRulesForWeb() {
  // Resolve current Gmail label names once per page load.
  const labelNamesById = Object.create(null);
  let labelsAvailable = false;

  try {
    getDestinationLabels_().forEach(label => {
      labelNamesById[label.id] = label.name;
    });
    labelsAvailable = true;
  } catch (err) {
    console.error('Could not refresh Gmail label names: ' + err.message);
  }

  return getRules_().map(rule => {
    let destinationName = rule.destinationLabelName || '—';

    if (rule.moveAfter !== 'never' &&
        rule.destinationLabelId &&
        labelsAvailable) {
      const labelId = rule.destinationLabelId;

      if (Object.prototype.hasOwnProperty.call(labelNamesById, labelId)) {
        destinationName = labelNamesById[labelId];

        // Save only a changed name. The destination ID stays unchanged.
        if (rule.destinationLabelName !== destinationName) {
          rule.destinationLabelName = destinationName;
          try {
            saveRule_(rule);
          } catch (err) {
            console.error('Could not save label name for rule ' +
                          rule.id + ': ' + err.message);
          }
        }
      } else {
        destinationName = '[Missing label] ' +
          (rule.destinationLabelName || labelId);
      }
    }

    const matchedWithinLastYear = hasRuleMatchedWithinLastYear_(rule);
    const moveText = rule.moveAfter === 'never'
      ? 'Never'
      : rule.moveAfter + ' days → ' + destinationName;
    const deleteText = rule.deleteAfter === 'never'
      ? 'Never'
      : rule.deleteAfter + ' days';

    return {
      id: rule.id,
      from: rule.from || '',
      words: rule.words || '',
      matchedWithinLastYear: matchedWithinLastYear,
      hasAttachmentText: rule.hasAttachment ? 'Yes' : 'No',
      moveText: moveText,
      deleteText: deleteText,
      removePreviousLabelsText: rule.removePreviousLabels ? 'Yes' : 'No'
    };
  });
}


function getExecutionHistoryForWeb() {
  return getExecutionHistory_().map(entry => {
    return {
      timeText:
        formatExecutionTime_(entry.startedAt),
      runType:
        entry.runType || 'Unknown',
      status:
        entry.status || 'Unknown',
      error:
        entry.error || ''
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

function resetInternalLabelHideMigration_() {
  PropertiesService
    .getUserProperties()
    .deleteProperty('MR_INTERNAL_LABELS_HIDDEN_V1');
}


