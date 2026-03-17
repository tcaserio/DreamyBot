// ============================================================
// Dreamy Disposition FC — Application Webhook
// ============================================================
// Paste this entire file into your Google Form's linked Sheet:
//   Extensions > Apps Script > replace all content > Save > run setup()
//
// SETUP STEPS:
//   1. Paste this script and save.
//   2. Fill in BOT_URL and WEBHOOK_SECRET below.
//   3. Run setup() once (click Run in the toolbar) to register the trigger.
//      You only need to do this once — the trigger persists on the Sheet.
//   4. Submit a test form entry to verify the bot receives it.
// ============================================================

var BOT_URL        = 'https://YOUR-RAILWAY-URL.railway.app/application';
var WEBHOOK_SECRET = 'YOUR_WEBHOOK_SECRET_HERE'; // Must match /config application-secret

// ─── Column name → field key mapping ────────────────────────────────────────
// These must match the exact header names in your linked Google Sheet.
// Open the Sheet (Form responses tab) and check row 1 if anything looks off.
var COLUMN_MAP = {
  'What is your in-game name? (Both first and last)':                       'in_game_name',
  'I agree to follow Dreamy Dispositions community rules.':                  'rules_agreed',
  'What made you consider our Free Company?':                                'how_found',
  'A new member is feeling a bit lost in the game, how would you help them out?': 'vibe_check',
  'I would like the following welcome package...':                           'welcome_package',
  'In case we are unable to contact you in game, you may leave your discord username here. (Optional)': 'discord_username',
};

// ─── Trigger setup ───────────────────────────────────────────────────────────
// Run this once manually to register the onFormSubmit trigger.
function setup() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();

  // Remove any existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'onFormSubmit'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(sheet)
    .onFormSubmit()
    .create();

  Logger.log('Trigger registered successfully.');
}

// ─── Main handler ────────────────────────────────────────────────────────────
function onFormSubmit(e) {
  var namedValues = e.namedValues; // { 'Column Header': ['value'], ... }
  var payload     = {};

  for (var col in COLUMN_MAP) {
    var fieldKey = COLUMN_MAP[col];
    var raw      = namedValues[col];
    if (!raw || raw.length === 0) continue;
    var value = raw[0].trim();

    if (fieldKey === 'rules_agreed') {
      // Checkbox — truthy if the value is non-empty (they had to check it to submit)
      payload[fieldKey] = value.length > 0;
    } else if (fieldKey === 'how_found') {
      // Multi-select checkboxes come as a comma-separated string
      payload[fieldKey] = value.split(', ').map(function(s) { return s.trim(); }).filter(Boolean);
    } else {
      payload[fieldKey] = value || null;
    }
  }

  var options = {
    method:      'post',
    contentType: 'application/json',
    headers:     { Authorization: WEBHOOK_SECRET },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(BOT_URL, options);
  Logger.log('Bot response: ' + response.getResponseCode() + ' ' + response.getContentText());
}
