// ═══════════════════════════════════════════════════════════════
//  Code.gs  — माँ सरस्वती पूजा समिति 2026
//  REST API Backend (fetch-based, koi google.script.run nahi)
//  Steps: 1) Yeh code paste karo  2) setup() run karo
//         3) Deploy → New Deployment → Web App → Anyone → Deploy
//         4) URL copy karo → App Settings mein paste karo
// ═══════════════════════════════════════════════════════════════

var DON_SHEET = "Donations";
var EXP_SHEET = "Expenses";
var SET_SHEET = "Settings";

// Sheet Headers (Sheet mein yahi dikhega - clean, no ID)
var DON_H = ["नाम","मोबाइल","राशि (₹)","श्रेणी","बुक नं.","रसीद नं.","पेमेंट","Txn नं.","दिनांक","उद्देश्य","समय"];
var EXP_H = ["विवरण","किसे दिया","राशि (₹)","श्रेणी","पेमेंट","Txn नं.","दिनांक","टिप्पणी","समय"];
var SET_H = ["Key","Value"];

var DEFAULT_SETS = {
  adminPassword      : "admin123",
  samitiName         : "श्री श्री 108 माँ सरस्वती पूजा समिति - 2026",
  donationCategories : ["सामान्य दान","विशेष दान","चंदा","वार्षिक दान","अन्य"],
  expenseCategories  : ["पूजा सामग्री","प्रसाद","सजावट","साउंड सिस्टम","भोजन","अन्य"]
};

// ── Sheet helper ──────────────────────────────────────────────
function getSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    var r = sh.getRange(1, 1, 1, headers.length);
    r.setFontWeight("bold").setFontColor("white").setFontSize(11)
     .setHorizontalAlignment("center");
    var colors = {};
    colors[DON_SHEET] = "#2E7D32";
    colors[EXP_SHEET] = "#C62828";
    colors[SET_SHEET] = "#D84315";
    r.setBackground(colors[name] || "#333");
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, headers.length, 130);
  }
  return sh;
}

// ── Read all rows as array of objects (with rowIndex) ─────────
function readRows(sh) {
  var last = sh.getLastRow();
  if (last <= 1) return [];
  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var hdrs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var out  = [];
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    var empty = row.every(function(c){ return c === "" || c === null || c === undefined; });
    if (!empty) {
      var obj = { rowIndex: i + 2 };
      hdrs.forEach(function(h, j){
        var val = row[j];
        if (val instanceof Date && !isNaN(val)) {
          val = Utilities.formatDate(val, "Asia/Kolkata", "yyyy-MM-dd");
        }
        obj[h] = (val === null || val === undefined) ? "" : val;
      });
      out.push(obj);
    }
  }
  return out;
}

// ── Read Settings as object ───────────────────────────────────
function readSettings(sh) {
  var last = sh.getLastRow();
  if (last <= 1) return DEFAULT_SETS;
  var vals = sh.getRange(2, 1, last - 1, 2).getValues();
  var map  = {};
  vals.forEach(function(r){ if (r[0]) map[String(r[0])] = r[1]; });
  function parseArr(v) { try { return JSON.parse(v); } catch(e) { return []; } }
  return {
    adminPassword      : map["adminPassword"]      || DEFAULT_SETS.adminPassword,
    samitiName         : map["samitiName"]         || DEFAULT_SETS.samitiName,
    donationCategories : map["donationCategories"] ? parseArr(map["donationCategories"]) : DEFAULT_SETS.donationCategories,
    expenseCategories  : map["expenseCategories"]  ? parseArr(map["expenseCategories"])  : DEFAULT_SETS.expenseCategories
  };
}

// ── Upsert a settings key ─────────────────────────────────────
function upsertSet(sh, key, val) {
  var last = sh.getLastRow();
  if (last > 1) {
    var keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        sh.getRange(i + 2, 2).setValue(val);
        return;
      }
    }
  }
  sh.appendRow([key, val]);
}

// ── JSON output helper ────────────────────────────────────────
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── India timestamp ───────────────────────────────────────────
function ts() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy HH:mm");
}

// ════════════════════════════════════════════════════════════
//  doGet — Sab data ek saath return karo / ya payload action handle karo
// ════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    // Agar payload parameter aaya hai to mutation action run karo
    // (Browser POST→GET convert karta hai GAS redirect ki wajah se,
    //  isliye mutations bhi GET se hi bhejte hain)
    if (e && e.parameter && e.parameter.payload) {
      var p = JSON.parse(e.parameter.payload);  // GAS auto-decodes URL params
      return handleAction(p);
    }

    // Normal GET — sab data return karo
    var s1 = getSheet(DON_SHEET, DON_H);
    var s2 = getSheet(EXP_SHEET, EXP_H);
    var s3 = getSheet(SET_SHEET, SET_H);
    return jsonOut({
      status    : "success",
      donations : readRows(s1),
      expenses  : readRows(s2),
      settings  : readSettings(s3)
    });
  } catch(err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

// ════════════════════════════════════════════════════════════
//  doPost — Bhi handleAction call karta hai (backward compatibility)
// ════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ status: "error", message: "POST data nahi mila." });
    }
    var p = JSON.parse(e.postData.contents);
    return handleAction(p);
  } catch(err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

// ════════════════════════════════════════════════════════════
//  handleAction — Sab CRUD operations yahan handle hote hain
// ════════════════════════════════════════════════════════════
function handleAction(p) {
  // LockService: Multiple devices ek saath write karne par conflict hota hai
  // Lock se ensure hota hai ki ek time pe sirf ek write ho
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // 15 second tak wait karo
    // ── DONATION ADD ──
    if (p.action === "add_donation") {
      var sh = getSheet(DON_SHEET, DON_H);
      sh.appendRow([ p.name||"", p.phone||"", Number(p.amount)||0, p.category||"",
                     p.bookNo||"", p.receiptNo||"", p.payMode||"नगद (Cash)",
                     p.txnNo||"", p.date||"", p.purpose||"", ts() ]);
      return jsonOut({ status:"success", message:"दान सेव हो गया! ✓" });
    }

    // ── DONATION UPDATE ──
    if (p.action === "update_donation") {
      var sh = getSheet(DON_SHEET, DON_H);
      sh.getRange(Number(p.rowIndex), 1, 1, 11).setValues([[
        p.name||"", p.phone||"", Number(p.amount)||0, p.category||"",
        p.bookNo||"", p.receiptNo||"", p.payMode||"नगद (Cash)",
        p.txnNo||"", p.date||"", p.purpose||"", ts()
      ]]);
      return jsonOut({ status:"success", message:"दान अपडेट हो गया! ✓" });
    }

    // ── DONATION DELETE ──
    if (p.action === "delete_donation") {
      getSheet(DON_SHEET, DON_H).deleteRow(Number(p.rowIndex));
      return jsonOut({ status:"success", message:"दान मिटाया! ✓" });
    }

    // ── EXPENSE ADD ──
    if (p.action === "add_expense") {
      var sh = getSheet(EXP_SHEET, EXP_H);
      sh.appendRow([ p.description||"", p.paidTo||"", Number(p.amount)||0, p.category||"",
                     p.payMode||"नगद (Cash)", p.txnNo||"", p.date||"", p.note||"", ts() ]);
      return jsonOut({ status:"success", message:"खर्चा सेव हो गया! ✓" });
    }

    // ── EXPENSE UPDATE ──
    if (p.action === "update_expense") {
      var sh = getSheet(EXP_SHEET, EXP_H);
      sh.getRange(Number(p.rowIndex), 1, 1, 9).setValues([[
        p.description||"", p.paidTo||"", Number(p.amount)||0, p.category||"",
        p.payMode||"नगद (Cash)", p.txnNo||"", p.date||"", p.note||"", ts()
      ]]);
      return jsonOut({ status:"success", message:"खर्चा अपडेट हो गया! ✓" });
    }

    // ── EXPENSE DELETE ──
    if (p.action === "delete_expense") {
      getSheet(EXP_SHEET, EXP_H).deleteRow(Number(p.rowIndex));
      return jsonOut({ status:"success", message:"खर्चा मिटाया! ✓" });
    }

    // ── SETTINGS UPDATE ──
    if (p.action === "update_settings") {
      var sh = getSheet(SET_SHEET, SET_H);
      if (p.adminPassword      !== undefined) upsertSet(sh, "adminPassword",      p.adminPassword);
      if (p.samitiName         !== undefined) upsertSet(sh, "samitiName",         p.samitiName);
      if (p.donationCategories !== undefined) upsertSet(sh, "donationCategories", JSON.stringify(p.donationCategories));
      if (p.expenseCategories  !== undefined) upsertSet(sh, "expenseCategories",  JSON.stringify(p.expenseCategories));
      return jsonOut({ status:"success", message:"Settings update! ✓" });
    }

    // ── RESET ALL ──
    if (p.action === "reset_all") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      [DON_SHEET, EXP_SHEET].forEach(function(name){
        var s = ss.getSheetByName(name);
        if (s && s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
      });
      return jsonOut({ status:"success", message:"सारा data reset! ✓" });
    }

    return jsonOut({ status:"error", message:"Unknown action: " + p.action });

  } catch(err) {
    return jsonOut({ status:"error", message: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════
//  SETUP — pehli baar run karein
//  Extensions → Apps Script → Function: setup → Run
// ════════════════════════════════════════════════════════════
function setup() {
  var s1 = getSheet(DON_SHEET, DON_H);
  var s2 = getSheet(EXP_SHEET, EXP_H);
  var s3 = getSheet(SET_SHEET, SET_H);
  // Write default settings
  var sets = DEFAULT_SETS;
  upsertSet(s3, "adminPassword",      sets.adminPassword);
  upsertSet(s3, "samitiName",         sets.samitiName);
  upsertSet(s3, "donationCategories", JSON.stringify(sets.donationCategories));
  upsertSet(s3, "expenseCategories",  JSON.stringify(sets.expenseCategories));

  SpreadsheetApp.getUi().alert(
    "✅ Setup Poora Ho Gaya!\n\n" +
    "Sheets bani hain:\n" +
    "  🟢 Donations\n  🔴 Expenses\n  🟠 Settings\n\n" +
    "Ab karo:\n" +
    "Deploy → New Deployment → Web App\n" +
    "Execute as: Me\n" +
    "Access: Anyone\n" +
    "→ Deploy → URL copy karo"
  );
}
