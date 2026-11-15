/**
 * Thanksgiving Sign-Up — Google Sheet backend.
 *
 * Paste this whole file into Extensions → Apps Script of your Google Sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * The first time the page loads, the "Signups" tab is created and filled with the default dishes.
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['id', 'category', 'dish', 'who', 'updated', 'code'];
var MAX_TRIES = 5, LOCK_MINUTES = 10;
var DEFAULT_ITEMS = [
  ['Mains', 'Turkey'], ['Mains', 'Ham'], ['Mains', 'Vegetarian main'],
  ['Sides', 'Mashed potatoes'], ['Sides', 'Stuffing'], ['Sides', 'Gravy'],
  ['Sides', 'Green bean casserole'], ['Sides', 'Sweet potatoes'], ['Sides', 'Mac and cheese'],
  ['Sides', 'Cranberry sauce'], ['Sides', 'Dinner rolls'], ['Sides', 'Salad'],
  ['Appetizers', 'Cheese and crackers'], ['Appetizers', 'Veggie tray'], ['Appetizers', 'Deviled eggs'],
  ['Desserts', 'Pumpkin pie'], ['Desserts', 'Apple pie'], ['Desserts', 'Pecan pie'],
  ['Desserts', 'Whipped cream / ice cream'],
  ['Drinks', 'Wine'], ['Drinks', 'Cider / soda'], ['Drinks', 'Coffee'],
  ['Supplies', 'Plates, cups and napkins'], ['Supplies', 'Ice'], ['Supplies', 'To-go containers']
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    var rows = DEFAULT_ITEMS.map(function (d, i) { return ['d' + (i + 1), d[0], d[1], '', '']; });
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
  }
  if (sh.getRange(1, 6).getValue() !== 'code') sh.getRange(1, 6).setValue('code');
  sh.getRange('F:F').setNumberFormat('@'); // keep codes like 0042 as text
  return sh;
}

function readItems_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r, i) {
      var c = String(r[5]).trim();
      return { id: String(r[0]), cat: String(r[1]), name: String(r[2]), who: String(r[3]), code: c ? ('0000' + c).slice(-4) : '', row: i + 2 };
    });
}

function clean_(s, max) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function norm_(s) { return clean_(s, 100).toLowerCase(); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function publicItems_(items) {
  return items.map(function (i) { return { id: i.id, cat: i.cat, name: i.name, who: i.who }; });
}

function doGet() {
  return json_({ ok: true, items: publicItems_(readItems_(getSheet_())) });
}

// Too many wrong codes for a name locks that name for a while.
function lockedMsg_(key) {
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return '';
  var st = JSON.parse(raw);
  if (st.until && st.until > Date.now()) {
    var mins = Math.ceil((st.until - Date.now()) / 60000);
    return 'Too many wrong codes. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.';
  }
  return '';
}
function badCode_(key) {
  var props = PropertiesService.getScriptProperties();
  var st = JSON.parse(props.getProperty(key) || '{"n":0}');
  if (st.until && st.until <= Date.now()) st = { n: 0 };
  st.n = (st.n || 0) + 1;
  if (st.n >= MAX_TRIES) { st = { n: 0, until: Date.now() + LOCK_MINUTES * 60000 }; }
  props.setProperty(key, JSON.stringify(st));
  return st.until ? 'Too many wrong codes. Try again in ' + LOCK_MINUTES + ' minutes.'
                  : 'That code doesn\'t match. ' + (MAX_TRIES - st.n) + ' tr' + (MAX_TRIES - st.n === 1 ? 'y' : 'ies') + ' left.';
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var sh = getSheet_();
    var items = readItems_(sh);
    var first = clean_(body.first, 25), last = clean_(body.last, 25);
    var name = (first + ' ' + last).trim();
    var code = String(body.code || '');
    var now = new Date();
    var msg = '';
    var fail = function (err) { return json_({ ok: false, error: err, items: publicItems_(items) }); };

    if (!first || !last) return fail('Please type your first and last name.');
    if (!/^\d{4}$/.test(code)) return fail('Please enter a 4-digit code.');

    var key = 'fail:' + norm_(name);
    var locked = lockedMsg_(key);
    if (locked) return fail(locked);

    // The code this name already uses, if they've signed up before.
    var known = items.filter(function (i) { return i.code && norm_(i.who) === norm_(name); })[0];
    if (known && known.code !== code) return fail(badCode_(key));
    if (known) PropertiesService.getScriptProperties().deleteProperty(key);

    if (body.action === 'claim') {
      var it = items.filter(function (i) { return i.id === body.id; })[0];
      if (!it) return fail('That dish is no longer on the list.');
      if (it.who) return fail(it.who + ' already signed up for ' + it.name + '.');
      sh.getRange(it.row, 4, 1, 3).setValues([[name, now, code]]);
      it.who = name; it.code = code;
      msg = 'Thanks, ' + first + '! You\'re bringing ' + it.name + '.';

    } else if (body.action === 'remove') {
      var u = items.filter(function (i) { return i.id === body.id; })[0];
      if (!u) return fail('That dish is no longer on the list.');
      if (!u.who) return fail(u.name + ' is already open.');
      if (norm_(u.who) !== norm_(name)) return fail('Only ' + u.who + ' can remove this.');
      if (u.code && u.code !== code) return fail(badCode_(key));
      if (u.id.charAt(0) === 'x') { sh.deleteRow(u.row); items = readItems_(sh); msg = 'Removed ' + u.name + '.'; }
      else { sh.getRange(u.row, 4, 1, 3).setValues([['', now, '']]); u.who = ''; u.code = ''; msg = u.name + ' is open again.'; }

    } else if (body.action === 'add') {
      var dish = clean_(body.dish, 60), cat = clean_(body.cat, 30) || 'Other';
      if (!dish) return fail('Type a dish name.');
      var id = 'x' + now.getTime().toString(36);
      sh.appendRow([id, cat, dish, name, now, code]);
      items.push({ id: id, cat: cat, name: dish, who: name, code: code });
      msg = 'Added ' + dish + ' — thanks, ' + first + '!';

    } else {
      return fail('Unknown action.');
    }

    return json_({ ok: true, message: msg, items: publicItems_(items) });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}
