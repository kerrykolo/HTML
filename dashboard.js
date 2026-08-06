const COLORS = {
  dark: '#1f3d2f',
  mid: '#3f6d5c',
  sage: '#7fa08e',
  pale: '#c3d6c9',
  grid: '#e1e0d9',
  mutedText: '#666666',
  negative: '#c0392b',
};

Chart.defaults.font.family = "'DM Sans', system-ui, -apple-system, sans-serif";
Chart.defaults.color = COLORS.mutedText;
Chart.defaults.borderColor = COLORS.grid;

const currency = (v) => '$' + Math.round(v).toLocaleString();
const compact = (v) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'K';
  return sign + abs;
};
const pct = (v) => {
  if (!Number.isFinite(v)) return 'N/A';
  const s = (v * 100).toFixed(1) + '%';
  return v < 0 ? `(${s.replace('-', '')})` : s;
};

const baseScales = {
  x: { grid: { display: false } },
  y: { grid: { color: COLORS.grid }, ticks: { callback: currency } },
};

const charts = {};

function renderTrendArea(canvasId, labels, data) {
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: COLORS.dark,
        backgroundColor: 'rgba(31, 61, 47, 0.12)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => currency(ctx.parsed.y) } } },
      scales: baseScales,
    },
  });
}

function renderGroupedBar(canvasId, labels, series) {
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        backgroundColor: s.color,
      })),
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${currency(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: COLORS.grid }, ticks: { callback: currency } },
      },
    },
  });
}

function renderComboBarLinePy(canvasId, categories, barLabel, barData, pyData) {
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    data: {
      labels: categories,
      datasets: [
        { type: 'bar', label: barLabel, data: barData, backgroundColor: COLORS.dark },
        { type: 'line', label: 'PY', data: pyData, borderColor: COLORS.sage, backgroundColor: COLORS.sage, borderWidth: 2, pointRadius: 5, tension: 0.25 },
      ],
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${currency(ctx.parsed.y)}` } },
      },
      scales: baseScales,
    },
  });
}

function renderVarianceBar(canvasId, categories, data) {
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: { labels: categories, datasets: [{ data, backgroundColor: COLORS.sage }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => currency(ctx.parsed.y) } } },
      scales: baseScales,
    },
  });
}

function renderKpiTiles(containerId, groups) {
  const el = document.getElementById(containerId);
  el.innerHTML = groups.map((g) => {
    const variance = (g.cy - g.py) / g.py;
    return `
      <div class="kpi-tile"><span class="kpi-label">${g.label} CY</span><span class="kpi-value">${compact(g.cy)}</span></div>
      <div class="kpi-tile"><span class="kpi-label">${g.label} PY</span><span class="kpi-value">${compact(g.py)}</span></div>
      <div class="kpi-tile"><span class="kpi-label">Variance</span><span class="kpi-value">${pct(variance)}</span></div>
    `;
  }).join('<div class="kpi-divider"></div>');
}

function renderQuarterTiles(containerId, label, values, quarterLabels) {
  const el = document.getElementById(containerId);
  el.innerHTML = `
    <h4 class="quarter-heading">${label}</h4>
    <div class="quarter-row">
      ${quarterLabels.map((q, i) => `
        <div class="quarter-tile"><span class="quarter-label">${q}</span><span class="quarter-value">${compact(values[i])}</span></div>
      `).join('')}
    </div>
  `;
}

function renderVarianceTable(containerId, rows) {
  const el = document.getElementById(containerId);
  const row = (r) => {
    const variance = r.actual - r.plan;
    const changePct = variance / r.plan;
    const cls = variance < 0 ? 'negative' : '';
    const rowCls = r.bold ? 'bold-row' : '';
    return `
      <tr class="${rowCls}">
        <td>${r.label}</td>
        <td>${currency(r.actual)}</td>
        <td>${currency(r.plan)}</td>
        <td class="${cls}">${currency(variance)}</td>
        <td class="${cls}">${pct(changePct)}</td>
      </tr>
    `;
  };
  el.innerHTML = `
    <div class="table-wrap">
      <table class="variance-table">
        <thead><tr><th></th><th>YTD Actual</th><th>YTD Plan</th><th>Var</th><th>% Change</th></tr></thead>
        <tbody>${rows.map(row).join('')}</tbody>
      </table>
    </div>
  `;
}

let D;

const renderers = {
  actuals() {
    renderKpiTiles('kpi-actuals', [
      { label: 'Revenue', ...D.kpis.revenue },
      { label: 'Expense', ...D.kpis.expenses },
      { label: 'EBITDA', ...D.kpis.ebitda },
    ]);
    renderTrendArea('chart-actuals-revenue', D.months, D.revenue);
    renderTrendArea('chart-actuals-expenses', D.months, D.expenses);
    renderTrendArea('chart-actuals-ebitda', D.months, D.ebitda);
    renderQuarterTiles('quarters-revenue', 'Revenue CY', D.fiscalQuarters.revenue, D.fiscalQuarters.labels);
    renderQuarterTiles('quarters-expenses', 'Expense CY', D.fiscalQuarters.expenses, D.fiscalQuarters.labels);
    renderQuarterTiles('quarters-ebitda', 'EBIT CY', D.fiscalQuarters.ebitda, D.fiscalQuarters.labels);
  },

  combo() {
    renderGroupedBar('chart-combo-costbreakdown', D.months, [
      { label: 'Direct Cost', data: D.costBreakdown.direct, color: COLORS.dark },
      { label: 'Indirect Cost', data: D.costBreakdown.indirect, color: COLORS.mid },
      { label: 'Overheads Cost', data: D.costBreakdown.overheads, color: COLORS.sage },
      { label: 'Total Wages Expense', data: D.costBreakdown.wages, color: COLORS.pale },
    ]);
    renderVarianceBar('chart-combo-ebitda-total', D.months, D.ebitda);
    renderMetricSet('combo-revenue', D.quarterly.revenue);
    renderMetricSet('combo-expenses', D.quarterly.expenses);
    renderMetricSet('combo-ebitda', D.quarterly.ebitda);
  },

  revenue() {
    renderMetricSet('revenue', D.quarterly.revenue);
  },

  expense() {
    renderGroupedBar('chart-expense-costbreakdown', D.months, [
      { label: 'Direct Cost', data: D.costBreakdown.direct, color: COLORS.dark },
      { label: 'Indirect Cost', data: D.costBreakdown.indirect, color: COLORS.mid },
      { label: 'Overheads Cost', data: D.costBreakdown.overheads, color: COLORS.sage },
      { label: 'Total Wages Expense', data: D.costBreakdown.wages, color: COLORS.pale },
    ]);
    renderMetricSet('expense', D.quarterly.expenses);
  },

  ebitda() {
    renderVarianceBar('chart-ebitda-total', D.months, D.ebitda);
    renderMetricSet('ebitda', D.quarterly.ebitda);
  },
};

function renderMetricSet(prefix, quarterly) {
  renderComboBarLinePy(`chart-${prefix}-actual`, quarterly.categories, 'Actual', quarterly.actual, quarterly.py);
  renderComboBarLinePy(`chart-${prefix}-budget`, quarterly.categories, 'Budget', quarterly.budget, quarterly.py);
  renderVarianceBar(`chart-${prefix}-variance`, quarterly.categories, quarterly.variance);
}

const renderedTabs = new Set();
let activeTabName = 'actuals';

function activateTab(tabName) {
  activeTabName = tabName;
  document.querySelectorAll('.dash-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.dash-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `tab-${tabName}`);
  });
  if (!renderedTabs.has(tabName)) {
    renderers[tabName]();
    renderedTabs.add(tabName);
  }
}

function destroyAllCharts() {
  Object.keys(charts).forEach((id) => {
    charts[id].destroy();
    delete charts[id];
  });
}

function populatePeriodSelect(select, availablePeriods) {
  if (!availablePeriods.length) {
    select.innerHTML = '<option value="">No periods found</option>';
    return;
  }
  select.innerHTML = availablePeriods
    .slice()
    .reverse()
    .map((p) => `<option value="${p.key}">${p.label}</option>`)
    .join('');
  select.value = availablePeriods[availablePeriods.length - 1].key;
}

function populateFilterSelect(select, values) {
  select.innerHTML = ['<option value="">All</option>', ...values.map((v) => `<option value="${v}">${v}</option>`)].join('');
  select.value = '';
}

function populateWorkbookSelect(select, workbookFiles) {
  select.innerHTML = workbookFiles.map((w) => `<option value="${w.file}">${w.label}</option>`).join('');
  select.value = workbookFiles[0].file;
}

let raw;

function currentFilters() {
  return {
    company: document.getElementById('company-select').value,
    tc1: document.getElementById('tc1-select').value,
    tc2: document.getElementById('tc2-select').value,
  };
}

function refresh() {
  const periodSelect = document.getElementById('period-select');
  D = buildDashboardData(raw, periodSelect.value, currentFilters());
  renderVarianceTable('table-summary', D.varianceTable);
  destroyAllCharts();
  renderedTabs.clear();
  renderers[activeTabName]();
  renderedTabs.add(activeTabName);
}

// Hides/shows everything driven by the currently-loaded workbook (filter
// bar, tab buttons, summary table) — but not individual tab panels, since
// which one is visible is activateTab()'s job, called right after a
// successful load.
function setDashboardChromeVisible(visible) {
  const nav = document.querySelector('.dash-tabs');
  const filtersBar = document.getElementById('filters-bar');
  const tableSummary = document.getElementById('table-summary');
  [nav, filtersBar, tableSummary].forEach((el) => {
    if (el) el.classList.toggle('hidden', !visible);
  });
}

// Loads the given workbook file, rebuilds every filter's options from it
// (companies/tracking categories/periods can differ file to file), then
// renders — used both for the initial load and every time the workbook
// dropdown changes.
async function loadWorkbookAndRender(fileName) {
  const loading = document.getElementById('dashboard-loading');

  destroyAllCharts();
  renderedTabs.clear();
  setDashboardChromeVisible(false);
  document.querySelectorAll('.dash-panel').forEach((panel) => panel.classList.add('hidden'));
  loading.textContent = 'Loading dashboard data…';
  loading.classList.remove('hidden');

  try {
    raw = await loadWorkbookRaw(fileName);

    populateFilterSelect(document.getElementById('company-select'), raw.companies);
    populateFilterSelect(document.getElementById('tc1-select'), raw.tc1Options);
    populateFilterSelect(document.getElementById('tc2-select'), raw.tc2Options);
    populatePeriodSelect(document.getElementById('period-select'), raw.availablePeriods);

    D = buildDashboardData(raw, document.getElementById('period-select').value, currentFilters());
    renderVarianceTable('table-summary', D.varianceTable);
  } catch (err) {
    loading.textContent = 'Could not load dashboard data: ' + err.message;
    console.error(err);
    return;
  }

  loading.classList.add('hidden');
  setDashboardChromeVisible(true);

  activateTab(activeTabName);
}

async function init() {
  const loading = document.getElementById('dashboard-loading');
  const workbookSelect = document.getElementById('workbook-select');
  const companySelect = document.getElementById('company-select');
  const tc1Select = document.getElementById('tc1-select');
  const tc2Select = document.getElementById('tc2-select');
  const periodSelect = document.getElementById('period-select');

  loading.textContent = 'Looking for workbook files…';

  let workbookFiles;
  try {
    workbookFiles = await discoverWorkbookFiles();
  } catch (err) {
    loading.textContent = 'Could not load workbook list: ' + err.message;
    console.error(err);
    return;
  }
  if (!workbookFiles.length) {
    loading.textContent = 'No workbook files found.';
    return;
  }
  populateWorkbookSelect(workbookSelect, workbookFiles);

  document.querySelectorAll('.dash-tab').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  [companySelect, tc1Select, tc2Select, periodSelect].forEach((select) => {
    select.addEventListener('change', refresh);
  });

  workbookSelect.addEventListener('change', () => loadWorkbookAndRender(workbookSelect.value));

  await loadWorkbookAndRender(workbookSelect.value);
}

init();
