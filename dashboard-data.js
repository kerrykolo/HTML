
const WORKBOOK_FILE = 'dashboard-data-workbook.xlsx';

const TYPE_MAP = {
  REVENUE: 'revenue',
  DIRECTCOSTS: 'direct',
  EXPENSE: 'indirect',
  OVERHEADS: 'overheads',
  WAGESEXPENSE: 'wages',
};

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

function aggregateByMonth(rows) {
  const byMonth = new Map();
  for (const row of rows) {
    const type = row[4];
    const period = row[10];
    const value = row[12];
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

async function loadWorkbookRaw() {
  const buf = await fetch(WORKBOOK_FILE).then((r) => {
    if (!r.ok) throw new Error(`Could not fetch ${WORKBOOK_FILE} (${r.status})`);
    return r.arrayBuffer();
  });
  const wb = XLSX.read(buf, { type: 'array' });
  const actualSheet = wb.Sheets['Profit and Loss'] || wb.Sheets[wb.SheetNames[0]];
  const budgetSheet = wb.Sheets[wb.SheetNames[1]];

  const actualRows = XLSX.utils.sheet_to_json(actualSheet, { header: 1, range: 1 });
  const budgetRows = XLSX.utils.sheet_to_json(budgetSheet, { header: 1, range: 1 });

  const actualByMonth = aggregateByMonth(actualRows);
  const budgetByMonth = aggregateByMonth(budgetRows);
  const sortedKeys = [...actualByMonth.keys()].sort();

  const availablePeriods = sortedKeys.slice(11).map((key) => ({
    key,
    label: monthLabelLong(actualByMonth.get(key).date),
  }));

  return { actualByMonth, budgetByMonth, sortedKeys, availablePeriods };
}

function buildDashboardData(raw, asOfKey) {
  const { actualByMonth, budgetByMonth, sortedKeys } = raw;
  const asOfIndex = sortedKeys.indexOf(asOfKey);
  const cyStart = Math.max(0, asOfIndex - 11);
  const cyKeys = sortedKeys.slice(cyStart, asOfIndex + 1);
  const pyStart = Math.max(0, cyStart - 12);
  const pyKeys = sortedKeys.slice(pyStart, cyStart);

  const months = cyKeys.map((k) => monthLabel(actualByMonth.get(k).date));

  const revenue = cyKeys.map((k) => actualByMonth.get(k).revenue);
  const expenses = cyKeys.map((k) => expensesOf(actualByMonth.get(k)));
  const ebitda = revenue.map((r, i) => r - expenses[i]);

  const costBreakdown = {
    direct: cyKeys.map((k) => actualByMonth.get(k).direct),
    indirect: cyKeys.map((k) => actualByMonth.get(k).indirect),
    overheads: cyKeys.map((k) => actualByMonth.get(k).overheads),
    wages: cyKeys.map((k) => actualByMonth.get(k).wages),
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
