
// ============================================================
// WORKBOOK FILE DISCOVERY — reads workbooks/manifest.json, a plain list
// of filenames living in the workbooks/ folder. To add a new workbook:
// drop the .xlsx file into workbooks/, then add its filename to that
// list. Any filename works — no naming pattern required. The dropdown
// shows the raw filename (extension stripped), not a reformatted label.
// ============================================================
const WORKBOOKS_DIR = 'workbooks';
const WORKBOOKS_MANIFEST = `${WORKBOOKS_DIR}/manifest.json`;

async function discoverWorkbookFiles() {
  const res = await fetch(WORKBOOKS_MANIFEST);
  if (!res.ok) throw new Error(`Could not fetch ${WORKBOOKS_MANIFEST} (${res.status})`);
  const fileNames = await res.json();
  return fileNames.map((name) => ({
    file: `${WORKBOOKS_DIR}/${name}`,
    label: name.replace(/\.xlsx$/i, ''),
  }));
}

const TYPE_MAP = {
  REVENUE: 'revenue',
  DIRECTCOSTS: 'direct',
  EXPENSE: 'indirect',
  OVERHEADS: 'overheads',
  WAGESEXPENSE: 'wages',
};

// Column indices into each row (rows come from
// XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1 })).
const COL_ORGANISATION = 0;
const COL_TYPE = 4;
const COL_TRACKING_1 = 8;
const COL_TRACKING_2 = 9;
const COL_PERIOD = 10;
const COL_VALUE = 12;

const EMPTY_MONTH = { revenue: 0, direct: 0, indirect: 0, overheads: 0, wages: 0 };

function excelSerialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', '-');
}

function monthLabelLong(date) {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function buildMonthDateIndex(rows) {
  const dates = new Map();
  for (const row of rows) {
    const period = row[COL_PERIOD];
    if (typeof period !== 'number') continue;
    const date = excelSerialToDate(period);
    const key = monthKey(date);
    if (!dates.has(key)) dates.set(key, date);
  }
  return dates;
}

function distinctValues(rows, colIndex) {
  const set = new Set();
  for (const row of rows) {
    const v = row[colIndex];
    if (v !== undefined && v !== null && v !== '') set.add(v);
  }
  return [...set].sort();
}

// filters: { company, tc1, tc2 } — any omitted/empty means "no filter" (All).
function aggregateByMonth(rows, filters) {
  const { company, tc1, tc2 } = filters || {};
  const byMonth = new Map();
  for (const row of rows) {
    if (company && row[COL_ORGANISATION] !== company) continue;
    if (tc1 && row[COL_TRACKING_1] !== tc1) continue;
    if (tc2 && row[COL_TRACKING_2] !== tc2) continue;

    const type = row[COL_TYPE];
    const period = row[COL_PERIOD];
    const value = row[COL_VALUE];
    const category = TYPE_MAP[type];
    if (!category || typeof period !== 'number' || typeof value !== 'number') continue;

    const date = excelSerialToDate(period);
    const key = monthKey(date);
    if (!byMonth.has(key)) {
      byMonth.set(key, { date, revenue: 0, direct: 0, indirect: 0, overheads: 0, wages: 0 });
    }
    const signedValue = category === 'revenue' ? value : -value;
    byMonth.get(key)[category] += signedValue;
  }
  return byMonth;
}

function monthOrZero(map, key) {
  return map.get(key) || EMPTY_MONTH;
}

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const expensesOf = (m) => m.direct + m.indirect + m.overheads + m.wages;

async function loadWorkbookRaw(fileName) {
  const buf = await fetch(fileName).then((r) => {
    if (!r.ok) throw new Error(`Could not fetch ${fileName} (${r.status})`);
    return r.arrayBuffer();
  });
  const wb = XLSX.read(buf, { type: 'array' });
  const actualSheet = wb.Sheets['Profit and Loss'] || wb.Sheets[wb.SheetNames[0]];
  const budgetSheet = wb.Sheets[wb.SheetNames[1]];

  const actualRows = XLSX.utils.sheet_to_json(actualSheet, { header: 1, range: 1 });
  const budgetRows = XLSX.utils.sheet_to_json(budgetSheet, { header: 1, range: 1 });

  // Period list is derived unfiltered, so the set of selectable "as of"
  // months stays stable regardless of which Company/Tracking filters are
  // applied — filters just zero out months with no matching data instead
  // of shrinking the period range.
  //
  // Every month with any data is offered as selectable — not just months
  // with 12 full trailing months behind them — since different workbooks
  // can have very different amounts of history (some may only span a few
  // months). buildDashboardData() already clamps its lookback window to
  // whatever's actually available, so an early/short selection just shows
  // fewer trailing months rather than breaking.
  const monthDates = buildMonthDateIndex(actualRows);
  const sortedKeys = [...monthDates.keys()].sort();
  const availablePeriods = sortedKeys.map((key) => ({
    key,
    label: monthLabelLong(monthDates.get(key)),
  }));

  const companies = distinctValues(actualRows, COL_ORGANISATION);
  const tc1Options = distinctValues(actualRows, COL_TRACKING_1);
  const tc2Options = distinctValues(actualRows, COL_TRACKING_2);

  return {
    actualRows, budgetRows, monthDates, sortedKeys, availablePeriods,
    companies, tc1Options, tc2Options,
  };
}

function buildDashboardData(raw, asOfKey, filters) {
  const { actualRows, budgetRows, monthDates, sortedKeys } = raw;
  const actualByMonth = aggregateByMonth(actualRows, filters);
  const budgetByMonth = aggregateByMonth(budgetRows, filters);

  const asOfIndex = sortedKeys.indexOf(asOfKey);
  const cyStart = Math.max(0, asOfIndex - 11);
  const cyKeys = sortedKeys.slice(cyStart, asOfIndex + 1);
  const pyStart = Math.max(0, cyStart - 12);
  const pyKeys = sortedKeys.slice(pyStart, cyStart);

  const months = cyKeys.map((k) => monthLabel(monthDates.get(k)));

  const revenue = cyKeys.map((k) => monthOrZero(actualByMonth, k).revenue);
  const expenses = cyKeys.map((k) => expensesOf(monthOrZero(actualByMonth, k)));
  const ebitda = revenue.map((r, i) => r - expenses[i]);

  const costBreakdown = {
    direct: cyKeys.map((k) => monthOrZero(actualByMonth, k).direct),
    indirect: cyKeys.map((k) => monthOrZero(actualByMonth, k).indirect),
    overheads: cyKeys.map((k) => monthOrZero(actualByMonth, k).overheads),
    wages: cyKeys.map((k) => monthOrZero(actualByMonth, k).wages),
  };

  const costBreakdownBudget = {
    direct: cyKeys.map((k) => monthOrZero(budgetByMonth, k).direct),
    indirect: cyKeys.map((k) => monthOrZero(budgetByMonth, k).indirect),
    overheads: cyKeys.map((k) => monthOrZero(budgetByMonth, k).overheads),
    wages: cyKeys.map((k) => monthOrZero(budgetByMonth, k).wages),
  };

  const budgetRevenue = cyKeys.map((k) => monthOrZero(budgetByMonth, k).revenue);
  const budgetExpenses = cyKeys.map((k) => expensesOf(monthOrZero(budgetByMonth, k)));
  const budgetEbitda = budgetRevenue.map((r, i) => r - budgetExpenses[i]);

  const pyRevenue = pyKeys.map((k) => monthOrZero(actualByMonth, k).revenue);
  const pyExpenses = pyKeys.map((k) => expensesOf(monthOrZero(actualByMonth, k)));
  const pyEbitda = pyRevenue.map((r, i) => r - pyExpenses[i]);

  const quarterCategories = [...months.slice(-3), 'YTD'];

  function buildQuarterly(actualArr, budgetArr, pyArr) {
    const actual = [...actualArr.slice(-3), sum(actualArr)];
    const budget = [...budgetArr.slice(-3), sum(budgetArr)];
    const py = [...pyArr.slice(-3), sum(pyArr)];
    const variance = actual.map((v, i) => v - budget[i]);
    return { categories: quarterCategories, actual, budget, py, variance };
  }

  const quarterly = {
    revenue: buildQuarterly(revenue, budgetRevenue, pyRevenue),
    expenses: buildQuarterly(expenses, budgetExpenses, pyExpenses),
    ebitda: buildQuarterly(ebitda, budgetEbitda, pyEbitda),
  };

  const fiscalQuarters = {
    labels: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'],
    revenue: [sum(revenue.slice(0, 3)), sum(revenue.slice(3, 6)), sum(revenue.slice(6, 9)), sum(revenue.slice(9, 12))],
    expenses: [sum(expenses.slice(0, 3)), sum(expenses.slice(3, 6)), sum(expenses.slice(6, 9)), sum(expenses.slice(9, 12))],
    ebitda: [sum(ebitda.slice(0, 3)), sum(ebitda.slice(3, 6)), sum(ebitda.slice(6, 9)), sum(ebitda.slice(9, 12))],
  };

  const kpis = {
    revenue: { cy: sum(revenue), py: sum(pyRevenue) },
    expenses: { cy: sum(expenses), py: sum(pyExpenses) },
    ebitda: { cy: sum(ebitda), py: sum(pyEbitda) },
  };

  const varianceTable = [
    { label: 'Total Revenue', actual: sum(revenue), plan: sum(budgetRevenue), bold: true },
    { label: 'Direct Cost', actual: sum(costBreakdown.direct), plan: sum(costBreakdownBudget.direct) },
    { label: 'Indirect Cost', actual: sum(costBreakdown.indirect), plan: sum(costBreakdownBudget.indirect) },
    { label: 'Overheads Cost', actual: sum(costBreakdown.overheads), plan: sum(costBreakdownBudget.overheads) },
    { label: 'Wages Expense', actual: sum(costBreakdown.wages), plan: sum(costBreakdownBudget.wages) },
    { label: 'Total Expense', actual: sum(expenses), plan: sum(budgetExpenses), bold: true },
    { label: 'EBITDA', actual: sum(ebitda), plan: sum(budgetEbitda), bold: true },
  ];

  return {
    months, revenue, expenses, ebitda, costBreakdown, quarterly,
    fiscalQuarters, kpis, varianceTable,
  };
}
