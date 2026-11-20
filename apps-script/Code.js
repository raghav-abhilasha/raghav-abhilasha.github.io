/**
 * Wedding RSVP backend.
 *
 * This script is bound to the "responses from RSVP" Google Sheet.
 * - doPost(e): receives an RSVP from the website and adds one row.
 * - doGet(e):  returns "RSVP endpoint is live" so you can test the URL.
 * - setup():   run ONCE from the Apps Script editor. Creates the header
 *              row (only if the first tab is empty), the Summary tab,
 *              and authorises the script.
 *
 * New-response emails go to the script owner. To send them somewhere
 * else, add a Script Property NOTIFY_EMAIL (Project Settings > Script
 * Properties). Leave it out to keep emails going to the owner.
 */

var SUMMARY_SHEET_NAME = 'Summary';
var MAX_FIELD_LENGTH = 1000;
var MAX_GUESTS = 20;

/**
 * Columns of the responses tab, in order: [JSON key sent by the site, header].
 * Changing this after responses exist will misalign old rows, so add new
 * columns only at the end.
 */
var COLUMNS = [
  ['timestamp', 'Timestamp'],
  ['fullName', 'Full name'],
  ['phone', 'Phone / WhatsApp'],
  ['attending', 'Attending'],
  ['guestCount', 'Number of guests'],
  ['guestNames', 'Guest names'],
  ['functions', 'Functions attending'],
  ['arrivalMode', 'Arrival mode'],
  ['arrivalPoint', 'Arrival terminal / station / ISBT'],
  ['arrivalNumber', 'Arrival flight / train no.'],
  ['arrivalTime', 'Arrival date & time'],
  ['departureMode', 'Departure mode'],
  ['departurePoint', 'Departure terminal / station / ISBT'],
  ['departureNumber', 'Departure flight / train no.'],
  ['departureTime', 'Departure date & time'],
  ['pickupDrop', 'Pickup / drop needed'],
  ['accommodation', 'Room needed'],
  ['stayNights', 'Nights of stay'],
  ['nightsCount', 'Number of nights'],
  ['rooms', 'Rooms needed'],
  ['food', 'Food preference'],
  ['dietary', 'Allergies / restrictions'],
  ['message', 'Message for the couple'],
];
var NUMBER_KEYS = { guestCount: true, nightsCount: true, rooms: true };

// ---------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------

function doGet() {
  var ready = false;
  try {
    ready = headerMatches_(getResponsesSheet_());
  } catch (err) {
    console.error('doGet check failed: ' + err);
  }
  return json_({ ok: true, message: 'RSVP endpoint is live', ready: ready });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON' });
  }

  // Honeypot: real guests never see the "website" field. Pretend success.
  if (data.website) return json_({ ok: true });

  var record = clean_(data);
  if (!record.fullName || !record.phone || (record.attending !== 'Yes' && record.attending !== 'No')) {
    return json_({ ok: false, error: 'Name, phone and attending are required' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'Busy, please try again' });
  }

  var rowNumber;
  try {
    var sheet = getResponsesSheet_();
    // Safety net if setup() was never run: only writes into an EMPTY tab.
    if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) writeHeader_(sheet);
    record.timestamp = new Date();
    sheet.appendRow(COLUMNS.map(function (c) { return record[c[0]]; }));
    SpreadsheetApp.flush();
    rowNumber = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  notify_(record, rowNumber);
  return json_({ ok: true, row: rowNumber });
}

// ---------------------------------------------------------------------
// One-time setup (run from the editor: select "setup", press Run)
// ---------------------------------------------------------------------

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var sheet = ss.getSheets()[0];
  var messages = [];

  if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
    writeHeader_(sheet);
    messages.push('Header row created on tab "' + sheet.getName() + '".');
  } else if (headerMatches_(sheet)) {
    messages.push('Header row already in place on tab "' + sheet.getName() + '". Nothing changed there.');
  } else {
    var stop = 'STOPPED: the first tab "' + sheet.getName() + '" already has content that is not the RSVP header. ' +
      'Nothing was changed. Clear that tab or move it, then run setup again.';
    props.setProperty('SETUP_STATUS', 'conflict');
    console.log(stop);
    return stop;
  }

  props.setProperty('RESPONSES_SHEET_ID', String(sheet.getSheetId()));
  props.setProperty('SETUP_STATUS', 'ok');

  if (ss.getSpreadsheetTimeZone() !== 'Asia/Kolkata') {
    ss.setSpreadsheetTimeZone('Asia/Kolkata');
    messages.push('Spreadsheet time zone set to Asia/Kolkata.');
  }

  if (ss.getSheetByName(SUMMARY_SHEET_NAME)) {
    messages.push('A "' + SUMMARY_SHEET_NAME + '" tab already exists. Left as is.');
  } else {
    buildSummary_(ss, sheet);
    messages.push('"' + SUMMARY_SHEET_NAME + '" tab created.');
  }

  messages.push('New-response emails will go to: ' + notifyEmail_());
  var out = messages.join('\n');
  console.log(out);
  return out;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function getResponsesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var id = PropertiesService.getScriptProperties().getProperty('RESPONSES_SHEET_ID');
  if (id) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (String(sheets[i].getSheetId()) === id) return sheets[i];
    }
  }
  return ss.getSheets()[0];
}

function writeHeader_(sheet) {
  var headers = COLUMNS.map(function (c) { return c[1]; });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f4ead9');
  sheet.setFrozenRows(1);
  if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).setNumberFormat('dd mmm yyyy, h:mm am/pm');
}

function headerMatches_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < COLUMNS.length) return false;
  var row = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
  return COLUMNS.every(function (c, i) { return row[i] === c[1]; });
}

/** Trim, cap length, and stop text being read as a formula. */
function clean_(data) {
  var out = {};
  COLUMNS.forEach(function (c) {
    var key = c[0];
    if (key === 'timestamp') return;
    var v = data[key];
    if (NUMBER_KEYS[key]) {
      var n = parseInt(v, 10);
      out[key] = isNaN(n) ? '' : Math.max(0, Math.min(MAX_GUESTS, n));
      return;
    }
    v = v == null ? '' : String(v).trim().slice(0, MAX_FIELD_LENGTH);
    // A leading apostrophe makes Sheets store the value as plain text:
    // phone numbers keep their format, and "=..." can't run as a formula.
    if (v && (key === 'phone' || /^[=+\-@]/.test(v))) v = "'" + v;
    out[key] = v;
  });
  return out;
}

function notifyEmail_() {
  return PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
}

/** Email the owner a summary of the new RSVP. Never blocks saving. */
function notify_(record, rowNumber) {
  try {
    var to = notifyEmail_();
    if (!to) return;
    var name = String(record.fullName).replace(/^'/, '');
    var subject = record.attending === 'Yes'
      ? 'RSVP: ' + name + ' is coming (' + record.guestCount + ' guest' + (record.guestCount === 1 ? '' : 's') + ')'
      : 'RSVP: ' + name + ' can\'t make it';
    var lines = COLUMNS.filter(function (c) {
      var v = record[c[0]];
      return c[0] !== 'timestamp' && v !== '' && v !== null && v !== undefined;
    }).map(function (c) {
      return c[1] + ': ' + String(record[c[0]]).replace(/^'/, '');
    });
    var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: lines.join('\n') + '\n\nSaved in row ' + rowNumber + ' of the sheet:\n' + url,
      name: 'Wedding RSVP',
    });
  } catch (err) {
    console.error('Notification email failed: ' + err);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function colLetter_(index) { // 1-based
  var s = '';
  while (index > 0) {
    var m = (index - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    index = Math.floor((index - 1) / 26);
  }
  return s;
}

/** Summary tab: formulas only, so it updates by itself. */
function buildSummary_(ss, responses) {
  var sum = ss.insertSheet(SUMMARY_SHEET_NAME, ss.getSheets().length);
  var tab = "'" + responses.getName().replace(/'/g, "''") + "'!";
  function col(key) {
    for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) {
      var L = colLetter_(i + 1);
      return tab + L + '2:' + L;
    }
    throw new Error('Unknown column ' + key);
  }
  var name = col('fullName'), att = col('attending'), guests = col('guestCount');
  var fn = col('functions'), nights = col('stayNights'), rooms = col('rooms');
  var acc = col('accommodation'), pick = col('pickupDrop'), food = col('food');

  sum.getRange('A1').setValue('RSVP summary').setFontSize(14).setFontWeight('bold');
  sum.getRange('A2').setValue('Updates automatically from the "' + responses.getName() + '" tab. Do not type in the grey cells.');

  var rows = [
    ['Total responses', '=COUNTA(' + name + ')'],
    ['Attending (responses)', '=COUNTIF(' + att + ',"Yes")'],
    ['Not attending (responses)', '=COUNTIF(' + att + ',"No")'],
    ['Total headcount (attending guests)', '=SUMIF(' + att + ',"Yes",' + guests + ')'],
    ['Need a room (responses)', '=COUNTIFS(' + att + ',"Yes",' + acc + ',"Yes")'],
    ['Rooms requested (where given)', '=SUMIFS(' + rooms + ',' + att + ',"Yes",' + acc + ',"Yes")'],
    ['Need pickup and/or drop (responses)', '=COUNTIFS(' + att + ',"Yes",' + pick + ',"<>No",' + pick + ',"<>")'],
  ];
  sum.getRange(4, 1, rows.length, 1).setValues(rows.map(function (r) { return [r[0]]; }));
  sum.getRange(4, 2, rows.length, 1).setFormulas(rows.map(function (r) { return [r[1]]; }));
  sum.getRange(4, 2, rows.length, 1).setBackground('#eeeeee').setFontWeight('bold');

  // Breakdown tables, side by side so their lengths can grow freely.
  var start = 4 + rows.length + 2; // header row of the tables
  function splitList(range) { // unique items from cells like "Wedding, Reception"
    return '=IFERROR(UNIQUE(TRANSPOSE(SPLIT(TEXTJOIN(", ",TRUE,' + range + '),", ",FALSE))),"")';
  }
  function table(colIdx, title, listFormula, countFormula, guestFormula, extraTitle, extraFormula) {
    var c = colLetter_(colIdx), c1 = colLetter_(colIdx + 1), c2 = colLetter_(colIdx + 2), c3 = colLetter_(colIdx + 3);
    var first = start + 1;
    var listRange = c + first + ':' + c;
    var heads = [title, 'Responses', 'Guests'];
    if (extraTitle) heads.push(extraTitle);
    sum.getRange(start, colIdx, 1, heads.length).setValues([heads]).setFontWeight('bold').setBackground('#f4ead9');
    sum.getRange(c + first).setFormula(listFormula);
    sum.getRange(c1 + first).setFormula('=ARRAYFORMULA(IF(' + listRange + '="","",' + countFormula(listRange) + '))');
    sum.getRange(c2 + first).setFormula('=ARRAYFORMULA(IF(' + listRange + '="","",' + guestFormula(listRange) + '))');
    if (extraTitle) sum.getRange(c3 + first).setFormula('=ARRAYFORMULA(IF(' + listRange + '="","",' + extraFormula(listRange) + '))');
  }

  table(1, 'Function', splitList(fn),
    function (r) { return 'COUNTIF(' + fn + ',"*"&' + r + '&"*")'; },
    function (r) { return 'SUMIF(' + fn + ',"*"&' + r + '&"*",' + guests + ')'; });

  table(5, 'Night of stay', splitList(nights),
    function (r) { return 'COUNTIF(' + nights + ',"*"&' + r + '&"*")'; },
    function (r) { return 'SUMIF(' + nights + ',"*"&' + r + '&"*",' + guests + ')'; },
    'Rooms (where given)',
    function (r) { return 'SUMIF(' + nights + ',"*"&' + r + '&"*",' + rooms + ')'; });

  table(10, 'Food preference', '=IFERROR(UNIQUE(FILTER(' + food + ',' + food + '<>"")),"")',
    function (r) { return 'COUNTIF(' + food + ',' + r + ')'; },
    function (r) { return 'SUMIF(' + food + ',' + r + ',' + guests + ')'; });

  sum.setColumnWidth(1, 280);
  sum.setColumnWidths(2, 12, 120);
  sum.setColumnWidth(5, 200);
  sum.setColumnWidth(10, 170);
  sum.setFrozenRows(2);
}
