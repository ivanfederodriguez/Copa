
let dashboardData = {};
let annualChart = null;

const formatterDecimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatterInteger = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const formatterOneDecimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

document.addEventListener('DOMContentLoaded', () => {
    // Display current user info
    const currentUser = Auth.getCurrentUser();
    if (currentUser) {
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = currentUser.name;
        }
    }

    // Logout handler
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('¿Está seguro que desea cerrar sesión?')) {
                Auth.logout();
            }
        });
    }

    // Fetch data from MAIN dashboard JSON which contains the 'annual' node
    fetch('../main/dashboard_data.json')
        .then(response => response.json())
        .then(data => {
            dashboardData = data;
            renderAnnualDashboard();
        })
        .catch(error => console.error('Error loading data:', error));

    // Nav Toggle Logic
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');

    if (toggle && menu) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.classList.toggle('open');
            menu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (menu.classList.contains('show') && !menu.contains(e.target) && e.target !== toggle) {
                menu.classList.remove('show');
                toggle.classList.remove('open');
            }
        });
    }
});

function renderAnnualDashboard() {
    if (!dashboardData || !dashboardData.annual) return;

    const annualData = dashboardData.annual;
    const periods = annualData.periods; // Array of {year, nominal, real}

    // Sorting
    periods.sort((a, b) => b.year - a.year);

    const currentYear = periods[0];
    const prevYear = periods[1];

    const kpiGrid = document.getElementById('annual-kpi-grid');
    if (!kpiGrid) return;

    // Formatting helpers
    const formatCurrency = (val) => {
        if (Math.abs(val) >= 1_000_000_000_000) {
            return `$${formatterDecimal.format(val / 1_000_000_000_000)} Billones`;
        }
        if (Math.abs(val) >= 1_000_000_000) {
            return `$${formatterInteger.format(val / 1_000_000_000)} Mil Millones`;
        }
        return `$${formatterInteger.format(val / 1_000_000)} M`;
    };

    const formatPct = (val) => {
        if (val === null || val === undefined) return '-';
        const sign = val >= 0 ? '+' : '';
        return `${sign}${formatterDecimal.format(val)}%`;
    };

    // 1. Current Year Card
    const cardCurrent = `
        <article class="kpi-card">
            <div class="kpi-label">Año ${currentYear.year}</div>
            <div class="kpi-value text-xl">${formatCurrency(currentYear.nominal)}</div>
            <div class="kpi-sub">
                <span style="color: var(--accent-primary); font-weight:700;">Real: ${formatCurrency(currentYear.real)}</span>
            </div>
        </article>
    `;

    // 2. Prev Year Card
    const cardPrev = `
        <article class="kpi-card">
            <div class="kpi-label">Año ${prevYear.year}</div>
            <div class="kpi-value text-xl" style="color: var(--text-secondary);">${formatCurrency(prevYear.nominal)}</div>
            <div class="kpi-sub">
                <span style="color: var(--text-secondary); font-weight:700;">Real: ${formatCurrency(prevYear.real)}</span>
            </div>
        </article>
    `;

    // 3. Var Nominal
    const varNom = currentYear.var_nominal !== undefined ? currentYear.var_nominal : ((currentYear.nominal / prevYear.nominal) - 1) * 100;
    const diffNom = currentYear.nominal - prevYear.nominal;

    const cardVarNom = `
        <article class="kpi-card">
            <div class="kpi-label">Variación Nominal</div>
            <div class="kpi-value ${varNom >= 0 ? 'text-success' : 'text-danger'}">
                ${varNom >= 0 ? '+' : ''}${formatCurrency(diffNom).replace('Billones', 'B').replace('Mil Millones', 'MM').replace('Mil M', 'MM')}
            </div>
            <div class="kpi-sub">
                <span style="font-weight: 700;">${formatPct(varNom)}</span>
                <span style="color: var(--text-secondary); margin-left: 5px;">Interanual</span>
            </div>
        </article>
    `;

    // 4. Var Real
    const varReal = currentYear.var_real !== undefined ? currentYear.var_real : ((currentYear.real / prevYear.real) - 1) * 100;
    const diffReal = currentYear.real - prevYear.real;

    const cardVarReal = `
        <article class="kpi-card">
            <div class="kpi-label">Variación Real</div>
            <div class="kpi-value ${varReal >= 0 ? 'text-success' : 'text-danger'}">
                ${varReal >= 0 ? '+' : ''}${formatCurrency(diffReal).replace('Billones', 'B').replace('Mil Millones', 'MM').replace('Mil M', 'MM')}
            </div>
            <div class="kpi-sub">
                <span style="font-weight: 700;">${formatPct(varReal)}</span>
                <span style="color: var(--text-secondary); margin-left: 5px;">Interanual</span>
            </div>
        </article>
    `;

    kpiGrid.innerHTML = cardCurrent + cardPrev + cardVarNom + cardVarReal;

    // Render Table
    renderTable(periods, formatCurrency, formatPct);

    // Render Charts
    const baseLabel = annualData.meta ? annualData.meta.base_ipc : 'Base Enero 2022';

    renderMixedChart(periods, baseLabel);
    renderNominalChart(periods);
    renderRealChart(periods, baseLabel);
}

function renderTable(periods, fmtCurr, fmtPct) {
    const tableBody = document.querySelector('#annual-table tbody');
    if (!tableBody) return;

    // Sort chronological: 2022, 2023, 2024, 2025
    const chrono = [...periods].sort((a, b) => a.year - b.year);

    let html = '';
    chrono.forEach(p => {
        const varNomClass = (p.var_nominal > 0) ? 'var-pos' : (p.var_nominal < 0 ? 'var-neg' : 'var-neu');
        const varRealClass = (p.var_real > 0) ? 'var-pos' : (p.var_real < 0 ? 'var-neg' : 'var-neu');

        html += `
            <tr>
                <td class="year-cell">${p.year}</td>
                <td>${fmtCurr(p.nominal)}</td>
                <td class="${varNomClass} var-tag">${fmtPct(p.var_nominal)}</td>
                <td>${fmtCurr(p.real)}</td>
                <td class="${varRealClass} var-tag">${fmtPct(p.var_real)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

let mixedChartInstance = null;
let nominalChartInstance = null;
let realChartInstance = null;

function renderMixedChart(periods, baseLabel) {
    const ctx = document.getElementById('annualChart').getContext('2d');
    const chronological = [...periods].sort((a, b) => a.year - b.year);
    const labels = chronological.map(p => p.year);

    // Create Gradient for Nominal (Primary)
    const gradientNom = ctx.createLinearGradient(0, 0, 0, 400);
    gradientNom.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
    gradientNom.addColorStop(1, 'rgba(16, 185, 129, 0.4)');

    // Real as Secondary (Gray) - OR Distinct?
    // User requested same colors as Main (Green vs Gray). 
    // We'll use Green for Nominal, Gray for Real in this comparison.
    const colorReal = '#94a3b8';

    if (mixedChartInstance) mixedChartInstance.destroy();

    mixedChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nominal',
                    data: chronological.map(p => p.nominal),
                    backgroundColor: gradientNom,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: `Real (${baseLabel.replace('Base ', '')})`,
                    data: chronological.map(p => p.real),
                    backgroundColor: colorReal,
                    borderRadius: 4,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#64748b', font: { weight: '600' } } },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (ctx) {
                            let val = ctx.raw;
                            let label = '';
                            if (val >= 1_000_000_000_000) label = `$${formatterInteger.format(Math.round(val / 1e12))} Billones`;
                            else label = `$${formatterInteger.format(Math.round(val / 1e9))} Mil M`;
                            return `${ctx.dataset.label}: ${label}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    border: { display: false },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { color: '#64748b', font: { weight: '500' }, callback: (val) => formatterInteger.format(Math.round(val / 1e12)) + 'B' },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { weight: '500' } }
                }
            }
        }
    });
}

function renderNominalChart(periods) {
    const ctx = document.getElementById('nominalChart').getContext('2d');
    const chronological = [...periods].sort((a, b) => a.year - b.year);
    const labels = chronological.map(p => p.year);
    const data = chronological.map(p => p.nominal);

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.4)');

    if (nominalChartInstance) nominalChartInstance.destroy();

    nominalChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Variación Nominal',
                data: data,
                backgroundColor: gradient,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (ctx) {
                            let val = ctx.raw;
                            if (val >= 1_000_000_000_000) return `$${formatterInteger.format(Math.round(val / 1e12))} Billones`;
                            return `$${formatterInteger.format(Math.round(val / 1e9))} Mil M`;
                        }
                    }
                }
            },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { weight: '500' } } }
            }
        }
    });
}

function renderRealChart(periods, baseLabel) {
    const ctx = document.getElementById('realChart').getContext('2d');
    const chronological = [...periods].sort((a, b) => a.year - b.year);
    const labels = chronological.map(p => p.year);
    const data = chronological.map(p => p.real);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(148, 163, 184, 0.9)');
    gradient.addColorStop(1, 'rgba(148, 163, 184, 0.4)');

    if (realChartInstance) realChartInstance.destroy();

    realChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Variación Real',
                data: data,
                backgroundColor: gradient,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (ctx) {
                            let val = ctx.raw;
                            if (val >= 1_000_000_000_000) return `$${formatterInteger.format(Math.round(val / 1e12))} Billones`;
                            return `$${formatterInteger.format(Math.round(val / 1e9))} Mil M`;
                        }
                    }
                }
            },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { weight: '500' } } }
            }
        }
    });
}
