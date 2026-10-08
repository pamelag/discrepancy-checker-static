/* Data Discrepancy Reporter — single-page app.
   Plain JavaScript, no libraries and no build step.

   Contents
     1. Helpers
     2. Welcome screen   (background cells, halo, call to action)
     3. App: Home        (current week and month)
     4. App: Discrepancies (the four-step import → detect → review → report flow)
     5. Router           (#/ welcome, #/home, #/discrepancies, #/records, #/user)
*/
(function () {
  'use strict';

  /* ================= 1. Helpers ================= */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                     'August', 'September', 'October', 'November', 'December'];
  var LAG = 5000;   // ms: stands in for the import and detection services

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  // dd/mmm/yyyy, e.g. 05/Oct/2026
  function formatDate(d) {
    return pad(d.getDate()) + '/' + MONTHS[d.getMonth()] + '/' + d.getFullYear();
  }
  function formatRange(a, b) { return formatDate(a) + ' – ' + formatDate(b); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function sameDay(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
  function mondayOffset(d) { return (d.getDay() + 6) % 7; }   // Monday = 0 … Sunday = 6
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /* ================= 2. Welcome screen ================= */

  // start() and stop() are called by the router, so the background only
  // animates while the welcome screen is the view on show.
  var landing = (function () {
    var root = document.documentElement;
    var cta = $('get-started');
    var halo = $('halo');
    var grid = $('grid');
    var heroInner = $('hero-inner');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    var active = false;

    // Entrance: content is visible without this; the class only adds the motion.
    root.classList.add('is-ready');

    // The two hairlines line up while the call to action has attention.
    function reconcile(on) {
      return function () { root.classList.toggle('is-reconciled', on); };
    }
    cta.addEventListener('pointerenter', reconcile(true));
    cta.addEventListener('pointerleave', reconcile(false));
    cta.addEventListener('focus', reconcile(true));
    cta.addEventListener('blur', reconcile(false));

    // Surfaced records: single grid cells fade in and out around the hero,
    // rose on the left half and sand on the right.
    var MAX_CELLS = 5;
    var SPAWN_EVERY = 1300;   // ms, plus a little jitter
    var spawnTimer = null;

    function cellSize() {
      return parseFloat(getComputedStyle(root).getPropertyValue('--cell')) || 56;
    }

    function overlaps(a, b, pad) {
      return a.left < b.right + pad && a.right > b.left - pad &&
             a.top < b.bottom + pad && a.bottom > b.top - pad;
    }

    function pickCell() {
      var size = cellSize();
      var w = window.innerWidth;
      var h = window.innerHeight;
      // The grid tile is centred, so lines fall half a cell either side of centre.
      var x0 = (((w / 2 - size / 2) % size) + size) % size;
      var y0 = (((h / 2 - size / 2) % size) + size) % size;
      var keepClear = heroInner.getBoundingClientRect();

      for (var attempt = 0; attempt < 12; attempt++) {
        // Stay inside the part of the grid that the mask leaves visible.
        var x = w * (0.16 + Math.random() * 0.68);
        var y = h * (0.18 + Math.random() * 0.64);
        var left = x0 + Math.floor((x - x0) / size) * size;
        var top = y0 + Math.floor((y - y0) / size) * size;
        var box = { left: left, top: top, right: left + size, bottom: top + size };
        if (!overlaps(box, keepClear, 10)) {
          return { left: left + 1, top: top + 1, warm: left + size / 2 > w / 2 };
        }
      }
      return null;
    }

    function spawnCell(startAt) {
      if (grid.childElementCount >= MAX_CELLS) { return; }
      var spot = pickCell();
      if (!spot) { return; }

      var cell = document.createElement('span');
      cell.className = 'cell ' + (spot.warm ? 'cell--sand' : 'cell--rose');
      cell.style.left = spot.left + 'px';
      cell.style.top = spot.top + 'px';
      if (startAt) { cell.style.animationDelay = '-' + startAt + 's'; }
      cell.addEventListener('animationend', function () { cell.remove(); });
      grid.appendChild(cell);
    }

    function clearCells() {
      while (grid.firstChild) { grid.removeChild(grid.firstChild); }
    }

    function scheduleCells() {
      spawnTimer = window.setTimeout(function () {
        if (!document.hidden && !reduceMotion.matches) { spawnCell(0); }
        scheduleCells();
      }, SPAWN_EVERY + Math.random() * 900);
    }

    window.addEventListener('resize', function () {
      if (!active) { return; }
      // Cell positions are tied to the viewport, so clear them when it changes.
      clearCells();
      if (reduceMotion.matches) { spawnCell(0); spawnCell(0); spawnCell(0); }
    });

    // The halo drifts a few pixels with the pointer.
    var RANGE = 18;          // maximum travel in px
    var EASING = 0.06;       // lower is slower
    var target = { x: 0, y: 0 };
    var current = { x: 0, y: 0 };
    var frame = null;

    function renderHalo() {
      current.x += (target.x - current.x) * EASING;
      current.y += (target.y - current.y) * EASING;
      halo.style.setProperty('--px', (current.x * RANGE).toFixed(2) + 'px');
      halo.style.setProperty('--py', (current.y * RANGE).toFixed(2) + 'px');

      var settled = Math.abs(target.x - current.x) < 0.001 &&
                    Math.abs(target.y - current.y) < 0.001;
      frame = settled ? null : requestAnimationFrame(renderHalo);
    }

    function moveTo(x, y) {
      if (!active) { return; }
      target.x = x;
      target.y = y;
      if (frame === null) { frame = requestAnimationFrame(renderHalo); }
    }

    window.addEventListener('pointermove', function (event) {
      if (reduceMotion.matches || !finePointer.matches) { return; }
      moveTo(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1
      );
    }, { passive: true });
    document.addEventListener('pointerleave', function () { moveTo(0, 0); });
    window.addEventListener('blur', function () { moveTo(0, 0); });

    // Call once the view is visible: cell positions are measured from the page.
    function start() {
      if (active) { return; }
      active = true;
      clearCells();
      // Seed a few so the first frame already shows the idea.
      spawnCell(1.4);
      spawnCell(1.9);
      spawnCell(0.6);
      if (reduceMotion.matches) { spawnCell(0); } else { scheduleCells(); }
    }

    function stop() {
      if (!active) { return; }
      active = false;
      window.clearTimeout(spawnTimer);
      spawnTimer = null;
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      target.x = target.y = current.x = current.y = 0;
      halo.style.setProperty('--px', '0px');
      halo.style.setProperty('--py', '0px');
      root.classList.remove('is-reconciled');
      clearCells();
    }

    return { start: start, stop: stop };
  })();

  /* ================= 3. App: Home — current week and month ================= */

  (function fillHomeRanges() {
    var weekStart = addDays(today, -mondayOffset(today));        // Monday
    var weekEnd = addDays(weekStart, 6);                          // Sunday
    var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    var monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var text = { week: formatRange(weekStart, weekEnd), month: formatRange(monthStart, monthEnd) };

    Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function (cell) {
      cell.textContent = text[cell.getAttribute('data-range')];
    });
  })();

  /* ================= 4. App: Discrepancies ================= */

  var ROWS = 50;           // records an import returns
  var SHEET_ROWS = 100;    // the sheet is larger than the data: 50 rows stay empty
  var SHEET_COLS = 26;     // A to Z: 20 data columns and 6 empty ones
  var state = {
    step: 1,
    view: 'form',          // 'form' (step 1) or 'sheet' (steps 2 to 4)
    start: null,           // selected start date
    end: null,             // selected end date
    range: null,           // the range that was imported
    importing: false,
    loaded: false,
    detecting: false,
    detected: false,
    accepted: false,
    note: ''               // a one-off message that replaces the default status line
  };
  var rows = [];
  var timers = { importing: null, detecting: null };

  var STEP_NAMES = { 1: 'Import data', 2: 'Detect discrepancies', 3: 'Review and Generate XLS', 4: 'Generate Report' };

  function isUnlocked(step) {
    if (step === 1) { return true; }
    if (step === 2) { return state.range !== null; }
    if (step === 3) { return state.detected; }
    return state.accepted;
  }

  function flaggedCount() {
    return rows.filter(function (r) { return r.issue; }).length;
  }

  function defaultStatus() {
    var n = flaggedCount();
    if (state.view === 'form') { return ''; }
    if (state.step === 2) {
      if (state.importing) { return 'Importing records for ' + formatRange(state.range.start, state.range.end) + '…'; }
      if (state.detecting) { return 'Comparing tickets with timesheet entries…'; }
      if (state.detected) { return n + ' of ' + ROWS + ' records flagged. Continue to Step 3 to review them.'; }
      return ROWS + ' records imported for ' + formatRange(state.range.start, state.range.end) + '.';
    }
    if (state.step === 3) {
      return state.accepted
        ? 'Review accepted. The XLS is ready.'
        : 'Check the ' + n + ' flagged rows, then accept the review.';
    }
    return 'Ready to summarise ' + ROWS + ' records and ' + n + ' discrepancies.';
  }

  /* ================= Discrepancies: render ================= */

  var stepper = $('stepper');
  var stepEls = Array.prototype.slice.call(stepper.querySelectorAll('.step'));

  function render() {
    var busy = state.importing || state.detecting;
    var onSheet = state.view !== 'form';

    // Stepper: exactly one highlighted step.
    stepEls.forEach(function (el) {
      var n = Number(el.getAttribute('data-step'));
      var btn = el.querySelector('.step__btn');
      var active = n === state.step;
      el.classList.toggle('is-active', active);
      el.classList.toggle('is-passed', n <= state.step);
      el.classList.toggle('is-locked', !isUnlocked(n));
      btn.setAttribute('aria-disabled', String(!isUnlocked(n)));
      if (active) { btn.setAttribute('aria-current', 'step'); } else { btn.removeAttribute('aria-current'); }
    });

    // Step content.
    $('import-form').hidden = state.view !== 'form';
    $('sheet-frame').hidden = !onSheet;
    $('progress').hidden = !busy;

    // Toolbar buttons belong to one step each.
    var showTools = state.view === 'sheet';
    $('btn-detect').hidden = !(showTools && state.step === 2);
    $('btn-detect').disabled = !state.loaded || busy;
    $('btn-accept').hidden = !(showTools && state.step === 3);
    $('btn-accept').disabled = state.accepted;
    $('btn-xls').hidden = !(showTools && state.step === 3 && state.accepted);
    $('btn-report').hidden = !(showTools && state.step === 4);
    $('sample-chip').hidden = !(onSheet && state.loaded);

    var text = state.note || defaultStatus();
    $('status').textContent = text;
    $('toolbar').hidden = !showTools && text === '';
  }

  function goToStep(n) {
    if (!isUnlocked(n)) {
      state.note = 'Finish Step ' + (n - 1) + ', ' + STEP_NAMES[n - 1] + ', before opening Step ' + n + '.';
      render();
      return;
    }
    state.step = n;
    state.view = n === 1 ? 'form' : 'sheet';
    state.note = '';
    render();
  }

  stepEls.forEach(function (el) {
    el.querySelector('.step__btn').addEventListener('click', function () {
      goToStep(Number(el.getAttribute('data-step')));
    });
  });

  /* ================= Step 1: calendars ================= */

  var calendars = {};

  function buildCalendar(kind) {
    var root = document.querySelector('[data-calendar="' + kind + '"]');
    var grid = root.querySelector('.calendar__grid');
    var year = today.getFullYear();
    var month = today.getMonth();
    var first = new Date(year, month, 1);
    var count = new Date(year, month + 1, 0).getDate();
    var days = [];

    root.querySelector('.calendar__month').textContent = MONTHS_LONG[month] + ' ' + year;

    ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(function (label) {
      var cell = document.createElement('span');
      cell.className = 'calendar__dow';
      cell.textContent = label;
      grid.appendChild(cell);
    });

    for (var blank = 0; blank < mondayOffset(first); blank++) {
      grid.appendChild(document.createElement('span'));
    }

    for (var d = 1; d <= count; d++) {
      (function (date) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day';
        btn.textContent = String(date.getDate());
        btn.setAttribute('aria-label', formatDate(date));
        btn.addEventListener('click', function () {
          state[kind] = sameDay(state[kind], date) ? null : date;
          $('import-error').textContent = '';
          renderCalendars();
        });
        grid.appendChild(btn);
        days.push({ date: date, btn: btn });
      })(new Date(year, month, d));
    }

    calendars[kind] = days;
  }

  function renderCalendars() {
    ['start', 'end'].forEach(function (kind) {
      calendars[kind].forEach(function (day) {
        var selected = sameDay(state[kind], day.date);
        var inRange = !!state.start && !!state.end && day.date >= state.start && day.date <= state.end;
        // A start date cannot fall after the end date, and the reverse.
        var blocked = kind === 'start'
          ? !!state.end && day.date > state.end
          : !!state.start && day.date < state.start;

        day.btn.classList.toggle('is-selected', selected);
        day.btn.classList.toggle('is-in-range', inRange && !selected);
        day.btn.classList.toggle('is-today', sameDay(today, day.date));
        day.btn.setAttribute('aria-pressed', String(selected));
        day.btn.disabled = blocked;
      });
    });

    $('start-value').textContent = state.start ? formatDate(state.start) : 'Not selected';
    $('end-value').textContent = state.end ? formatDate(state.end) : 'Not selected';
    $('import-start').value = state.start ? isoDate(state.start) : '';
    $('import-end').value = state.end ? isoDate(state.end) : '';
  }

  $('import-form').addEventListener('reset', function () {
    state.start = null;
    state.end = null;
    $('import-error').textContent = '';
    renderCalendars();
  });

  $('import-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!state.start || !state.end) {
      $('import-error').textContent = !state.start && !state.end
        ? 'Choose a start date and an end date.'
        : (!state.start ? 'Choose a start date.' : 'Choose an end date.');
      return;
    }
    startImport();
  });

  /* ================= Spreadsheet ================= */

  var COLUMNS = [
    { key: 'ticketId',       name: 'Ticket ID',       width: 104, type: 'code' },
    { key: 'summary',        name: 'Summary',         width: 250, type: 'text' },
    { key: 'project',        name: 'Project',         width: 140, type: 'text' },
    { key: 'assignee',       name: 'Assignee',        width: 132, type: 'text' },
    { key: 'status',         name: 'Status',          width: 112, type: 'text' },
    { key: 'priority',       name: 'Priority',        width: 92,  type: 'text' },
    { key: 'created',        name: 'Created',         width: 116, type: 'code' },
    { key: 'resolved',       name: 'Resolved',        width: 116, type: 'code' },
    { key: 'estimate',       name: 'Estimate (h)',    width: 108, type: 'num'  },
    { key: 'ticketHours',    name: 'Ticket Hours',    width: 112, type: 'num'  },
    { key: 'timesheetId',    name: 'Timesheet ID',    width: 116, type: 'code' },
    { key: 'employee',       name: 'Employee',        width: 132, type: 'text' },
    { key: 'workDate',       name: 'Work Date',       width: 116, type: 'code' },
    { key: 'weekEnding',     name: 'Week Ending',     width: 116, type: 'code' },
    { key: 'ticketRef',      name: 'Ticket Ref',      width: 104, type: 'code' },
    { key: 'activity',       name: 'Activity',        width: 124, type: 'text' },
    { key: 'timesheetHours', name: 'Timesheet Hours', width: 132, type: 'num'  },
    { key: 'billable',       name: 'Billable',        width: 88,  type: 'text' },
    { key: 'approver',       name: 'Approver',        width: 132, type: 'text' },
    { key: 'approval',       name: 'Approval',        width: 108, type: 'text' }
  ];
  var ROW_HEAD_WIDTH = 44;
  var EMPTY_COL_WIDTH = 112;

  var sheet = $('sheet');
  var fieldCells = [];   // header cells that take the field names
  var bodyRows = [];     // { tr, cells: { key: td } } for all 100 rows; cells holds the 20 data columns

  function buildSheet() {
    var colgroup = document.createElement('colgroup');
    var thead = document.createElement('thead');
    var letters = document.createElement('tr');
    var fields = document.createElement('tr');
    var tbody = document.createElement('tbody');
    var total = ROW_HEAD_WIDTH;

    function col(width) {
      var c = document.createElement('col');
      c.style.width = width + 'px';
      colgroup.appendChild(c);
    }
    function head(row, className) {
      var th = document.createElement('th');
      th.scope = 'col';
      if (className) { th.className = className; }
      row.appendChild(th);
      return th;
    }

    letters.className = 'letters';
    fields.className = 'fields';
    col(ROW_HEAD_WIDTH);
    head(letters, 'rowhead');
    head(fields, 'rowhead');

    for (var c = 0; c < SHEET_COLS; c++) {
      var column = COLUMNS[c];                                   // undefined for the empty columns U to Z
      var width = column ? column.width : EMPTY_COL_WIDTH;
      col(width);
      total += width;
      head(letters).textContent = String.fromCharCode(65 + c);   // A … Z
      var field = head(fields, column ? 't-' + column.type : '');
      if (column) { fieldCells.push(field); }
    }

    for (var r = 0; r < SHEET_ROWS; r++) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      var cells = {};
      th.scope = 'row';
      th.className = 'rowhead';
      th.textContent = String(r + 1);
      tr.appendChild(th);
      for (var k = 0; k < SHEET_COLS; k++) {
        var td = document.createElement('td');
        if (COLUMNS[k]) {
          td.className = 't-' + COLUMNS[k].type;
          cells[COLUMNS[k].key] = td;
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      bodyRows.push({ tr: tr, cells: cells });
    }

    thead.appendChild(letters);
    thead.appendChild(fields);
    sheet.appendChild(colgroup);
    sheet.appendChild(thead);
    sheet.appendChild(tbody);
    sheet.style.width = total + 'px';
  }

  function clearFlags() {
    bodyRows.forEach(function (row) {
      row.tr.classList.remove('is-flagged');
      COLUMNS.forEach(function (column) { row.cells[column.key].classList.remove('is-mismatch'); });
    });
  }

  function clearSheet() {
    clearFlags();
    fieldCells.forEach(function (th) { th.textContent = ''; });
    bodyRows.forEach(function (row) {
      COLUMNS.forEach(function (column) {
        row.cells[column.key].textContent = '';
        row.cells[column.key].removeAttribute('title');
      });
    });
  }

  function fillSheet() {
    fieldCells.forEach(function (th, i) { th.textContent = COLUMNS[i].name; });
    bodyRows.forEach(function (row, r) {
      if (!rows[r]) { return; }                 // rows 51 to 100 stay empty
      COLUMNS.forEach(function (column) {
        var td = row.cells[column.key];
        td.textContent = rows[r][column.key];
        td.title = rows[r][column.key];
      });
    });
  }

  function flagRows() {
    bodyRows.forEach(function (row, r) {
      var issue = rows[r] && rows[r].issue;
      if (!issue) { return; }
      row.tr.classList.add('is-flagged');
      issue.cells.forEach(function (key) { row.cells[key].classList.add('is-mismatch'); });
    });
  }

  /* ================= Sample data (stands in for the real import) ================= */

  var PEOPLE = ['Amara Okafor', 'Marco Rossi', 'Jun Tanaka', 'Sana Patel',
                'Linh Nguyen', 'Rami Haddad', 'Eva Novak', 'Chidi Mbeki'];
  var APPROVERS = ['Helen Brandt', 'Tomás Ortega', 'Priya Raman'];
  var PROJECTS = ['Billing Platform', 'Payroll Sync', 'Customer Portal', 'Data Warehouse', 'Internal Tools'];
  var STATUSES = ['Open', 'In Progress', 'In Review', 'Done', 'Done', 'Closed'];
  var PRIORITIES = ['Low', 'Medium', 'Medium', 'High', 'Critical'];
  var ACTIVITIES = ['Development', 'Code Review', 'Testing', 'Analysis', 'Support', 'Meeting'];
  var APPROVALS = ['Approved', 'Approved', 'Approved', 'Pending', 'Rejected'];
  var SUMMARIES = [
    'Reconcile vendor invoice feed', 'Fix timezone drift in exports', 'Migrate billing webhooks',
    'Audit SSO login failures', 'Update onboarding checklist', 'Refactor ledger sync job',
    'Investigate duplicate payouts', 'Patch report scheduler', 'Clean up stale API keys',
    'Tune search indexing', 'Add retry to import worker', 'Review contractor access',
    'Resolve payroll rounding error', 'Document escalation path', 'Upgrade database driver',
    'Validate tax code mapping'
  ];

  // Rows (1-based) where the ticket and the timesheet disagree, and how.
  var ISSUES = {
    3: 'hours', 7: 'employee', 12: 'ticket', 19: 'hours',
    26: 'hours', 34: 'employee', 41: 'ticket', 47: 'hours'
  };
  var ISSUE_LABELS = {
    hours: 'Hours differ between ticket and timesheet',
    employee: 'Timesheet employee is not the ticket assignee',
    ticket: 'Timesheet refers to a different ticket'
  };
  var ISSUE_CELLS = {
    hours: ['ticketHours', 'timesheetHours'],
    employee: ['assignee', 'employee'],
    ticket: ['ticketId', 'ticketRef']
  };

  // Small seeded generator so the sample is the same on every run.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildRows(range) {
    var rand = seeded(20261007);
    var span = daysBetween(range.start, range.end) + 1;
    var out = [];
    function pick(list) { return list[Math.floor(rand() * list.length)]; }

    for (var i = 0; i < ROWS; i++) {
      var person = pick(PEOPLE);
      var work = addDays(range.start, Math.floor(rand() * span));
      var created = addDays(work, -Math.floor(rand() * 10));
      var status = pick(STATUSES);
      var closed = status === 'Done' || status === 'Closed';
      var hours = (Math.floor(rand() * 15) + 2) / 2;                 // 1.0 to 8.0
      var estimate = Math.max(hours, (Math.floor(rand() * 20) + 2) / 2);
      var ticketNumber = 1040 + i * 3 + Math.floor(rand() * 3);
      var row = {
        ticketId: 'DDR-' + ticketNumber,
        summary: pick(SUMMARIES),
        project: pick(PROJECTS),
        assignee: person,
        status: status,
        priority: pick(PRIORITIES),
        created: formatDate(created),
        resolved: closed ? formatDate(addDays(work, Math.floor(rand() * 4))) : '',
        estimate: estimate.toFixed(1),
        ticketHours: hours.toFixed(1),
        timesheetId: 'TS-' + (88200 + i * 7 + Math.floor(rand() * 7)),
        employee: person,
        workDate: formatDate(work),
        weekEnding: formatDate(addDays(work, 6 - mondayOffset(work))),
        ticketRef: 'DDR-' + ticketNumber,
        activity: pick(ACTIVITIES),
        timesheetHours: hours.toFixed(1),
        billable: rand() < 0.75 ? 'Yes' : 'No',
        approver: pick(APPROVERS),
        approval: pick(APPROVALS),
        issue: null
      };

      var kind = ISSUES[i + 1];
      if (kind === 'hours') {
        row.timesheetHours = (hours + (rand() < 0.5 ? 1.5 : 2.5)).toFixed(1);
      } else if (kind === 'employee') {
        row.employee = PEOPLE[(PEOPLE.indexOf(person) + 3) % PEOPLE.length];
      } else if (kind === 'ticket') {
        row.ticketRef = 'DDR-' + (ticketNumber - 11);
      }
      if (kind) { row.issue = { kind: kind, cells: ISSUE_CELLS[kind] }; }
      out.push(row);
    }
    return out;
  }

  /* ================= Steps 1 → 2: import ================= */

  function startImport() {
    clearTimeout(timers.importing);
    clearTimeout(timers.detecting);

    state.range = { start: state.start, end: state.end };
    state.importing = true;
    state.loaded = false;
    state.detecting = false;
    state.detected = false;
    state.accepted = false;
    state.note = '';
    state.step = 2;                // the highlight moves from Step 1 to Step 2
    state.view = 'sheet';
    rows = [];
    clearSheet();
    $('sheet-scroll').scrollTop = 0;
    $('sheet-scroll').scrollLeft = 0;
    render();

    timers.importing = setTimeout(function () {
      rows = buildRows(state.range);
      fillSheet();
      state.importing = false;
      state.loaded = true;
      render();
    }, LAG);
  }

  /* ================= Step 2: detect ================= */

  $('btn-detect').addEventListener('click', function () {
    if (!state.loaded || state.importing || state.detecting) { return; }
    clearTimeout(timers.detecting);
    clearFlags();
    state.detecting = true;
    state.detected = false;
    state.accepted = false;
    state.note = '';
    render();

    timers.detecting = setTimeout(function () {
      flagRows();
      state.detecting = false;
      state.detected = true;
      render();
    }, LAG);
  });

  /* ================= Step 3: accept, then XLS ================= */

  $('btn-accept').addEventListener('click', function () {
    state.accepted = true;
    state.note = '';
    render();
    $('btn-xls').focus();
  });

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // An HTML table saved as .xls opens in Excel and keeps the red rows.
  function buildXls() {
    var html = '<html><head><meta charset="utf-8"></head><body><table border="1"><tr>';
    COLUMNS.forEach(function (column) { html += '<th>' + escapeHtml(column.name) + '</th>'; });
    html += '<th>Discrepancy</th></tr>';
    rows.forEach(function (row) {
      html += row.issue ? '<tr style="background:#fdeaeb">' : '<tr>';
      COLUMNS.forEach(function (column) {
        var odd = row.issue && row.issue.cells.indexOf(column.key) !== -1;
        html += '<td' + (odd ? ' style="background:#f8c4c8;color:#a11f2a;font-weight:bold"' : '') + '>' +
                escapeHtml(row[column.key]) + '</td>';
      });
      html += '<td>' + (row.issue ? escapeHtml(ISSUE_LABELS[row.issue.kind]) : '') + '</td></tr>';
    });
    return html + '</table></body></html>';
  }

  $('btn-xls').addEventListener('click', function () {
    var blob = new Blob(['\uFEFF', buildXls()], { type: 'application/vnd.ms-excel' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'discrepancy-review.xls';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    state.note = 'discrepancy-review.xls generated with ' + ROWS + ' rows, ' + flaggedCount() + ' of them flagged.';
    render();
  });

  /* ================= Step 4: summary ================= */

  $('btn-report').addEventListener('click', function () {
    var counts = { hours: 0, employee: 0, ticket: 0 };
    rows.forEach(function (row) { if (row.issue) { counts[row.issue.kind]++; } });
    state.note = ROWS + ' records reviewed for ' + formatRange(state.range.start, state.range.end) + '. ' +
      flaggedCount() + ' discrepancies: ' + counts.hours + ' in hours, ' +
      counts.employee + ' in employee, ' + counts.ticket + ' in ticket reference.';
    render();
  });

  /* ================= 5. Router ================= */

  // One document, two views. The address after the # decides what is on show:
  //   #/                welcome screen
  //   #/home            app, Home
  //   #/discrepancies   app, Discrepancies
  //   #/records         app, Records
  //   #/user            app, User
  // Links are ordinary anchors, so Back, Forward, reload and bookmarks all work.

  var APP_NAME = 'Data Discrepancy Reporter';
  var PAGES = { home: 'Home', discrepancies: 'Discrepancies', records: 'Records', user: 'User' };

  var viewLanding = $('view-landing');
  var viewApp = $('view-app');
  var pageEls = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var navItems = Array.prototype.slice.call(document.querySelectorAll('.nav__item'));

  // '#/home', '#home' and '#/home/' all mean 'home'; anything unknown is the welcome screen.
  function currentRoute() {
    var name = location.hash.replace(/^#\/?/, '').replace(/\/$/, '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(PAGES, name) ? name : 'welcome';
  }

  function showPage(name) {
    pageEls.forEach(function (el) { el.hidden = el.getAttribute('data-page') !== name; });
    navItems.forEach(function (a) {
      if (a.getAttribute('data-page') === name) { a.setAttribute('aria-current', 'page'); }
      else { a.removeAttribute('aria-current'); }
    });
    $('main').scrollTop = 0;
  }

  function route() {
    var name = currentRoute();
    var welcome = name === 'welcome';

    viewLanding.hidden = !welcome;
    viewApp.hidden = welcome;

    if (welcome) {
      landing.start();
      window.scrollTo(0, 0);
    } else {
      landing.stop();
      showPage(name);
    }
    document.title = welcome ? APP_NAME : PAGES[name] + ' · ' + APP_NAME;
  }

  window.addEventListener('hashchange', route);

  /* ================= Start ================= */

  buildCalendar('start');
  buildCalendar('end');
  renderCalendars();
  buildSheet();
  render();
  route();
})();
