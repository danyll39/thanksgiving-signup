/**
 * Thanksgiving Sign-Up — Google Sheet backend.
 *
 * Paste this whole file into Extensions → Apps Script of your Google Sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * The first time the page loads, the "Signups" tab is created and filled with the default dishes.
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['id', 'category', 'dish', 'who', 'updated'];
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
    sh.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }
  return sh;
}

function readItems_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r, i) {
      return { id: String(r[0]), cat: String(r[1]), name: String(r[2]), who: String(r[3]), row: i + 2 };
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

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var sh = getSheet_();
    var items = readItems_(sh);
    var name = clean_(body.name, 40);
    var now = new Date();
    var msg = '';

    if (!name) return json_({ ok: false, error: 'Please type your name first.', items: publicItems_(items) });

    if (body.action === 'claim') {
      var it = items.filter(function (i) { return i.id === body.id; })[0];
      if (!it) return json_({ ok: false, error: 'That dish is no longer on the list.', items: publicItems_(items) });
      if (it.who) return json_({ ok: false, error: it.who + ' already signed up for ' + it.name + '.', items: publicItems_(items) });
      sh.getRange(it.row, 4, 1, 2).setValues([[name, now]]);
      it.who = name;
      msg = 'Thanks, ' + name + '! You\'re bringing ' + it.name + '.';

    } else if (body.action === 'remove') {
      var u = items.filter(function (i) { return i.id === body.id; })[0];
      if (!u) return json_({ ok: false, error: 'That dish is no longer on the list.', items: publicItems_(items) });
      if (norm_(u.who) !== norm_(name)) return json_({ ok: false, error: 'Only ' + u.who + ' can remove this.', items: publicItems_(items) });
      if (u.id.charAt(0) === 'x') { sh.deleteRow(u.row); items = readItems_(sh); msg = 'Removed ' + u.name + '.'; }
      else { sh.getRange(u.row, 4, 1, 2).setValues([['', now]]); u.who = ''; msg = u.name + ' is open again.'; }

    } else if (body.action === 'add') {
      var dish = clean_(body.dish, 60), cat = clean_(body.cat, 30) || 'Other';
      if (!dish) return json_({ ok: false, error: 'Type a dish name.', items: publicItems_(items) });
      var id = 'x' + now.getTime().toString(36);
      sh.appendRow([id, cat, dish, name, now]);
      items.push({ id: id, cat: cat, name: dish, who: name });
      msg = 'Added ' + dish + ' — thanks, ' + name + '!';

    } else {
      return json_({ ok: false, error: 'Unknown action.', items: publicItems_(items) });
    }

    return json_({ ok: true, message: msg, items: publicItems_(items) });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}
