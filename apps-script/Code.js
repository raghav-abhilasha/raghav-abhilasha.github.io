/**
 * Wedding RSVP backend.
 *
 * This script is bound to the "responses from RSVP" Google Sheet.
 * Layout of the responses (first) tab: column A holds the labels, and
 * each RSVP is one column, B, C, D ..., so entries read left to right.
 *
 * - doPost(e): receives an RSVP from the website and adds one column.
 * - doGet(e):  returns "RSVP endpoint is live" so you can test the URL.
 * - setup():   run from the Apps Script editor. Creates the label column
 *              (only if the first tab is empty), turns an old row-style
 *              tab into the column layout, and (re)builds the Summary tab.
 *
 * New-response emails go to the script owner. To send them somewhere
 * else, add a Script Property NOTIFY_EMAIL (Project Settings > Script
 * Properties). Leave it out to keep emails going to the owner.
 */

var SUMMARY_SHEET_NAME = 'Summary';
var SUMMARY_TITLE = 'RSVP summary';
var MAX_FIELD_LENGTH = 1000;
var MAX_GUESTS = 20;
var TIMESTAMP_FORMAT = 'dd mmm yyyy, h:mm am/pm';

/**
 * Fields of the responses tab, top to bottom: [JSON key sent by the site, label].
 * Changing the order after responses exist will misalign old entries, so
 * add new fields only at the end (new rows at the bottom).
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
    ready = labelsMatch_(getResponsesSheet_());
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

  var attending = plain_(data.attending);
  if (!plain_(data.fullName) || !plain_(data.phone) || (attending !== 'Yes' && attending !== 'No')) {
    return json_({ ok: false, error: 'Name, phone and attending are required' });
  }
  var record = clean_(data);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'Busy, please try again' });
  }

  var column;
  try {
    var sheet = getResponsesSheet_();
    if (isEmpty_(sheet)) {
      writeLabels_(sheet); // safety net if setup() was never run
    } else if (oldRowLayout_(sheet)) {
      convertToColumns_(sheet); // tab still in the old row layout
      rebuildSummary_(SpreadsheetApp.getActiveSpreadsheet(), sheet);
    }
    record.timestamp = new Date();
    column = Math.max(sheet.getLastColumn(), 1) + 1;
    ensureColumns_(sheet, column);
    var range = sheet.getRange(1, column, COLUMNS.length, 1);
    range.setValues(COLUMNS.map(function (c) { return [record[c[0]]]; }));
    range.setWrap(true).setVerticalAlignment('top');
    sheet.getRange(1, column).setNumberFormat(TIMESTAMP_FORMAT);
    sheet.setColumnWidth(column, 210);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  notify_(record, colLetter_(column));
  return json_({ ok: true, column: colLetter_(column) });
}

// ---------------------------------------------------------------------
// Setup (run from the editor: select "setup", press Run)
// ---------------------------------------------------------------------

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var sheet = getResponsesSheet_();
  var messages = [];

  if (isEmpty_(sheet)) {
    writeLabels_(sheet);
    messages.push('Label column created on tab "' + sheet.getName() + '".');
  } else if (labelsMatch_(sheet)) {
    messages.push('Tab "' + sheet.getName() + '" is already in the column layout. Nothing changed there.');
  } else if (oldRowLayout_(sheet)) {
    var moved = convertToColumns_(sheet);
    messages.push('Tab "' + sheet.getName() + '" turned sideways: labels in column A, ' + moved +
      ' existing entr' + (moved === 1 ? 'y' : 'ies') + ' now in columns B onwards.');
  } else {
    var stop = 'STOPPED: the first tab "' + sheet.getName() + '" has content that is not the RSVP layout. ' +
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

  messages.push(rebuildSummary_(ss, sheet));
  messages.push('New-response emails will go to: ' + notifyEmail_());
  var out = messages.join('\n');
  console.log(out);
  return out;
}

// ---------------------------------------------------------------------
// Layout helpers
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

function isEmpty_(sheet) {
  return sheet.getLastRow() === 0 && sheet.getLastColumn() === 0;
}

function labels_() {
  return COLUMNS.map(function (c) { return c[1]; });
}

/** Column A holds the labels (current layout). */
function labelsMatch_(sheet) {
  if (sheet.getLastRow() < COLUMNS.length) return false;
  var col = sheet.getRange(1, 1, COLUMNS.length, 1).getValues();
  return COLUMNS.every(function (c, i) { return col[i][0] === c[1]; });
}

/** Row 1 holds the labels (the first, row-per-RSVP layout). */
function oldRowLayout_(sheet) {
  if (sheet.getLastColumn() < COLUMNS.length) return false;
  var row = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
  return COLUMNS.every(function (c, i) { return row[i] === c[1]; });
}

function ensureColumns_(sheet, needed) {
  var max = sheet.getMaxColumns();
  if (needed > max) sheet.insertColumnsAfter(max, needed - max + 20);
}

function styleLabels_(sheet) {
  sheet.getRange(1, 1, COLUMNS.length, 1).setFontWeight('bold').setBackground('#f4ead9').setVerticalAlignment('top');
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidth(1, 240);
}

function writeLabels_(sheet) {
  sheet.getRange(1, 1, COLUMNS.length, 1).setValues(labels_().map(function (l) { return [l]; }));
  styleLabels_(sheet);
}

/**
 * Turns the old layout (labels in row 1, one RSVP per row) sideways.
 * Every value is kept; only its position changes. Returns the number of
 * entries moved.
 */
function convertToColumns_(sheet) {
  var values = sheet.getDataRange().getValues(); // [row][col]
  var width = Math.max(COLUMNS.length, values[0].length);
  var entries = values.slice(1);
  // Re-apply the same text protection new entries get (see clean_).
  var cleaned = entries.map(function (row) {
    var rec = {};
    COLUMNS.forEach(function (c, i) { rec[c[0]] = row[i]; });
    var out = clean_(rec);
    out.timestamp = row[0];
    var cells = COLUMNS.map(function (c) { return out[c[0]]; });
    for (var j = COLUMNS.length; j < width; j++) cells.push(row[j] === undefined ? '' : row[j]); // extra columns kept too
    return cells;
  });
  var labels = labels_();
  for (var k = COLUMNS.length; k < width; k++) labels.push(values[0][k]);

  sheet.clear();
  sheet.setFrozenRows(0);
  ensureColumns_(sheet, cleaned.length + 1);
  if (sheet.getMaxRows() < width) sheet.insertRowsAfter(sheet.getMaxRows(), width - sheet.getMaxRows());

  // grid[r][c]: r = field, c = 0 for labels, 1.. for entries
  var grid = labels.map(function (label, r) {
    return [label].concat(cleaned.map(function (cells) { return cells[r]; }));
  });
  sheet.getRange(1, 1, width, grid[0].length).setValues(grid);
  styleLabels_(sheet);
  if (cleaned.length) {
    sheet.getRange(1, 2, width, cleaned.length).setWrap(true).setVerticalAlignment('top');
    sheet.getRange(1, 2, 1, cleaned.length).setNumberFormat(TIMESTAMP_FORMAT);
    sheet.setColumnWidths(2, cleaned.length, 210);
  }
  SpreadsheetApp.flush();
  return cleaned.length;
}

// ---------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------

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
    if (Object.prototype.toString.call(v) === '[object Date]') { // only when converting old cells
      v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'EEE d MMM yyyy, HH:mm');
    }
    v = v == null ? '' : String(v).trim().slice(0, MAX_FIELD_LENGTH);
    // A leading apostrophe makes Sheets keep the value exactly as typed:
    // phone numbers and "Thu 10 Dec 2026, 19:00" are not turned into
    // numbers or dates, and "=..." can't run as a formula. It isn't shown.
    if (v) v = "'" + v;
    out[key] = v;
  });
  return out;
}

/** Value as the person typed it: no surrounding spaces, no text-marker apostrophe. */
function plain_(v) {
  return v == null ? '' : String(v).trim().replace(/^'/, '');
}

function notifyEmail_() {
  return PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
}

/** Email the owner a summary of the new RSVP. Never blocks saving. */
function notify_(record, columnLetter) {
  try {
    var to = notifyEmail_();
    if (!to) return;
    var name = plain_(record.fullName);
    var subject = plain_(record.attending) === 'Yes'
      ? 'RSVP: ' + name + ' is coming (' + record.guestCount + ' guest' + (record.guestCount === 1 ? '' : 's') + ')'
      : 'RSVP: ' + name + ' can\'t make it';
    var lines = COLUMNS.filter(function (c) {
      var v = record[c[0]];
      return c[0] !== 'timestamp' && v !== '' && v !== null && v !== undefined;
    }).map(function (c) {
      return c[1] + ': ' + plain_(record[c[0]]);
    });
    var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: lines.join('\n') + '\n\nSaved in column ' + columnLetter + ' of the sheet:\n' + url,
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

// ---------------------------------------------------------------------
// Summary tab (formulas only, so it updates by itself)
// ---------------------------------------------------------------------

/** Creates the Summary tab, or rewrites it if it is the one this script made. */
function rebuildSummary_(ss, responses) {
  var sum = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!sum) {
    sum = ss.insertSheet(SUMMARY_SHEET_NAME, ss.getSheets().length);
  } else if (sum.getRange('A1').getValue() !== SUMMARY_TITLE) {
    return 'A "' + SUMMARY_SHEET_NAME + '" tab exists that this script did not make. Left as is.';
  } else {
    sum.clear();
  }
  buildSummary_(sum, responses);
  return '"' + SUMMARY_SHEET_NAME + '" tab built for the column layout.';
}

function buildSummary_(sum, responses) {
  var tab = "'" + responses.getName().replace(/'/g, "''") + "'!";
  function row(key) { // the field's row, from column B to the right
    for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) return tab + 'B' + (i + 1) + ':' + (i + 1);
    throw new Error('Unknown field ' + key);
  }
  var name = row('fullName'), att = row('attending'), guests = row('guestCount');
  var fn = row('functions'), nights = row('stayNights'), rooms = row('rooms');
  var acc = row('accommodation'), pick = row('pickupDrop'), food = row('food');

  sum.getRange('A1').setValue(SUMMARY_TITLE).setFontSize(14).setFontWeight('bold');
  sum.getRange('A2').setValue('Updates automatically from the "' + responses.getName() + '" tab. Do not type in the grey cells.');

  var lines = [
    ['Total responses', '=COUNTA(' + name + ')'],
    ['Attending (responses)', '=COUNTIF(' + att + ',"Yes")'],
    ['Not attending (responses)', '=COUNTIF(' + att + ',"No")'],
    ['Total headcount (attending guests)', '=SUMIF(' + att + ',"Yes",' + guests + ')'],
    ['Need a room (responses)', '=COUNTIFS(' + att + ',"Yes",' + acc + ',"Yes")'],
    ['Rooms requested (where given)', '=SUMIFS(' + rooms + ',' + att + ',"Yes",' + acc + ',"Yes")'],
    ['Need pickup and/or drop (responses)', '=COUNTIFS(' + att + ',"Yes",' + pick + ',"<>No*",' + pick + ',"<>")'],
  ];
  sum.getRange(4, 1, lines.length, 1).setValues(lines.map(function (r) { return [r[0]]; }));
  sum.getRange(4, 2, lines.length, 1).setFormulas(lines.map(function (r) { return [r[1]]; }));
  sum.getRange(4, 2, lines.length, 1).setBackground('#eeeeee').setFontWeight('bold');

  // Breakdown tables, side by side so their lengths can grow freely.
  var start = 4 + lines.length + 2; // header row of the tables
  function splitList(range) { // unique items from cells like "Thu 10 Dec, Fri 11 Dec"
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

  table(10, 'Food preference', '=IFERROR(TRANSPOSE(UNIQUE(FILTER(' + food + ',' + food + '<>""),TRUE)),"")',
    function (r) { return 'COUNTIF(' + food + ',' + r + ')'; },
    function (r) { return 'SUMIF(' + food + ',' + r + ',' + guests + ')'; });

  sum.setColumnWidth(1, 280);
  sum.setColumnWidths(2, 12, 120);
  sum.setColumnWidth(5, 200);
  sum.setColumnWidth(10, 170);
  sum.setFrozenRows(2);
}
