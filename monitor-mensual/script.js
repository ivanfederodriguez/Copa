// Global state to hold fetched data
let dashboardData = null;

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

    fetch('../main/dashboard_data.json')
        .then(response => response.json())
        .then(data => {
            dashboardData = data;
            initMonthSelector(data.meta.available_periods);
        })
        .catch(error => console.error('Error loading data:', error));
});

function initMonthSelector(periods) {
    const selector = document.getElementById('month-selector');

    // Clear loading option
    selector.innerHTML = '';

    // Populate options
    periods.forEach(period => {
        const option = document.createElement('option');
        option.value = period.id;
        option.textContent = period.label + ' ' + period.year;
        selector.appendChild(option);
    });

    // Select default period
    // Priority: meta.default_period_id > last available period
    let defaultId = dashboardData.meta.default_period_id;
    if (!defaultId && periods.length > 0) {
        defaultId = periods[periods.length - 1].id;
    }

    selector.value = defaultId;

    // Render initial data
    renderDashboard(defaultId);

    // Handle changes
    selector.addEventListener('change', (e) => {
        renderDashboard(e.target.value);
    });
}

function renderDashboard(periodId) {
    if (!dashboardData || !dashboardData.data[periodId]) return;

    const periodData = dashboardData.data[periodId];

    // Parse Year and Month from Period ID (e.g., "2026-01")
    const [yearStr, monthStr] = periodId.split('-');
    const currentYear = parseInt(yearStr);
    const prevYear = currentYear - 1;

    // Update KPI Grid
    renderKPIs(periodData.kpi);

    // Dynamic Labels
    const periodLabel = periodData.kpi.meta.periodo; // "Enero 2026"
    const monthName = periodLabel.split(' ')[0]; // "Enero"

    // Update Header Text
    const headerTitle = document.querySelector('h1.text-gradient');
    if (headerTitle) {
        headerTitle.textContent = `Coparticipación Federal - Análisis ${periodData.kpi.meta.periodo}`;
    }

    // Update Main Subtitle
    const mainSubtitle = document.getElementById('main-subtitle');
    if (mainSubtitle) {
        mainSubtitle.textContent = `Análisis comparativo del comportamiento de transferencias nacionales (CFI Neta de Ley 26075) para el período ${monthName} ${prevYear} vs ${monthName} ${currentYear}.`;
    }

    // Update Recaudación Labels
    const lblRecCurrent = document.getElementById('label-recaudacion-current');
    if (lblRecCurrent) lblRecCurrent.textContent = `Recaudación ${monthName} ${currentYear}`;

    const lblRecPrev = document.getElementById('label-recaudacion-prev');
    if (lblRecPrev) lblRecPrev.textContent = `Recaudación ${monthName} ${prevYear}`;

    // Update Masa Salarial Subtitle
    const masaSubtitle = document.getElementById('masa-salarial-subtitle');
    if (masaSubtitle) {
        masaSubtitle.textContent = `Relación entre Coparticipación y Masa Salarial para ${monthName} ${prevYear} vs ${currentYear}`;
    }

    // Update Masa Salarial Labels
    const lblMasaCurrent = document.getElementById('label-masa-current');
    if (lblMasaCurrent) lblMasaCurrent.textContent = `Masa Salarial ${monthName} ${currentYear}`;

    const lblMasaPrev = document.getElementById('label-masa-prev');
    if (lblMasaPrev) lblMasaPrev.textContent = `Masa Salarial ${monthName} ${prevYear}`;

    // Update Chart Title
    const chartTitle = document.getElementById('chart-title');
    if (chartTitle) chartTitle.textContent = `Comportamiento Diario ${monthName}`;

    // Update Chart
    renderChart(periodData.charts.daily, monthName, currentYear, prevYear);
}

// ... Format functions ...
function formatCurrency(value) {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value * 1000000);
}
function formatMillions(value) {
    if (value === undefined || value === null) return 'N/A';
    return '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value) + ' M';
}

function formatPercentage(value) {
    if (value === undefined || value === null) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    const formattedValue = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
    return `${sign}${formattedValue}%`;
}

function renderKPIs(kpi) {
    // --- Recaudación ---
    document.getElementById('kpi-recaudacion-current').textContent = formatMillions(kpi.recaudacion.current);
    document.getElementById('kpi-recaudacion-prev').textContent = formatMillions(kpi.recaudacion.prev);

    // Var Nominal
    const recVarNomEl = document.getElementById('kpi-recaudacion-var-nom');
    const diffSign = kpi.recaudacion.diff_nom >= 0 ? '+' : '';
    recVarNomEl.textContent = diffSign + formatMillions(Math.abs(kpi.recaudacion.diff_nom));
    recVarNomEl.className = `kpi-value ${kpi.recaudacion.diff_nom >= 0 ? 'text-success' : 'text-danger'}`;

    const recVarNomSub = document.getElementById('kpi-recaudacion-var-nom-pct');
    recVarNomSub.textContent = (kpi.recaudacion.var_nom >= 0 ? '▲ ' : '▼ ') + formatPercentage(kpi.recaudacion.var_nom).replace('+', '');

    // Var Real (Check IPC Missing)
    const recVarRealEl = document.getElementById('real-var-val');

    if (kpi.recaudacion.ipc_missing) {
        recVarRealEl.textContent = 'Sin datos';
        recVarRealEl.className = 'kpi-value text-secondary';
    } else {
        recVarRealEl.textContent = formatPercentage(kpi.recaudacion.var_real);
        recVarRealEl.className = `kpi-value ${kpi.recaudacion.var_real >= 0 ? 'text-success' : 'text-secondary'}`;
        if (kpi.recaudacion.var_real < 0) recVarRealEl.classList.add('text-danger');
    }

    // --- Masa Salarial ---
    const masaCurrentEl = document.getElementById('kpi-masa-current');

    // Cobertura text
    document.getElementById('kpi-masa-cob-current').textContent = `Cobertura: ${kpi.masa_salarial.cobertura_current.toFixed(1)}%`;
    document.getElementById('kpi-masa-cob-prev').textContent = `Cobertura: ${kpi.masa_salarial.cobertura_prev.toFixed(1)}%`;

    // Masse Salarial Logic - Check for incomplete data
    const isIncomplete = kpi.masa_salarial.is_incomplete;
    const isIpcMissing = kpi.recaudacion.ipc_missing;

    // Masa Current
    if (isIncomplete) {
        masaCurrentEl.textContent = 'Sin datos';
        // Optional: change style to gray?
    } else {
        masaCurrentEl.textContent = formatMillions(kpi.masa_salarial.current);
    }

    document.getElementById('kpi-masa-prev').textContent = formatMillions(kpi.masa_salarial.prev);

    // Var Nominal Masa
    const masaVarNomEl = document.getElementById('kpi-masa-var-nom');
    const masaVarNomSub = document.getElementById('kpi-masa-var-nom-pct');

    if (isIncomplete) {
        masaVarNomEl.textContent = 'Sin datos';
        masaVarNomEl.className = 'kpi-value text-secondary';
        masaVarNomSub.textContent = ' - ';
    } else {
        const masaDiffSign = kpi.masa_salarial.diff_nom >= 0 ? '+' : '';
        masaVarNomEl.textContent = masaDiffSign + formatMillions(Math.abs(kpi.masa_salarial.diff_nom));
        masaVarNomEl.className = `kpi-value ${kpi.masa_salarial.diff_nom >= 0 ? 'text-success' : 'text-danger'}`;

        masaVarNomSub.textContent = (kpi.masa_salarial.var_nom >= 0 ? '▲ ' : '▼ ') + formatPercentage(kpi.masa_salarial.var_nom).replace('+', '');
    }

    // Var Real Masa
    const masaVarRealEl = document.getElementById('kpi-masa-var-real');

    if (isIncomplete || isIpcMissing) {
        masaVarRealEl.textContent = 'Sin datos';
        masaVarRealEl.className = 'kpi-value text-secondary';
    } else {
        masaVarRealEl.textContent = formatPercentage(kpi.masa_salarial.var_real);
        masaVarRealEl.className = `kpi-value ${kpi.masa_salarial.var_real >= 0 ? 'text-success' : 'text-danger'}`;
    }
}

let dailyChartInstance = null;

function renderChart(dailyData, monthName, currentYear, prevYear) {
    const ctx = document.getElementById('dailyChart').getContext('2d');

    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }

    // Gradient for 2026 (Green/Emerald)
    const gradient2026 = ctx.createLinearGradient(0, 0, 0, 400);
    gradient2026.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
    gradient2026.addColorStop(1, 'rgba(16, 185, 129, 0.4)');

    dailyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dailyData.labels,
            datasets: [
                {
                    label: `${monthName} ${currentYear}`,
                    data: dailyData.data_curr,
                    backgroundColor: gradient2026,
                    borderRadius: 4,
                    borderSkipped: false,
                    order: 1
                },
                {
                    label: `${monthName} ${prevYear}`,
                    data: dailyData.data_prev_nom,
                    backgroundColor: '#94a3b8', // Slate Gray (consistent with other dashboards)
                    borderRadius: 4,
                    borderSkipped: false,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (context.parsed.y !== null) {
                                return `${label}: $${new Intl.NumberFormat('es-AR').format(Math.round(context.parsed.y))} M`;
                            }
                        },
                        afterBody: function (tooltipItems) {
                            const valCurr = tooltipItems[0].raw || 0;
                            const valPrev = tooltipItems[1] ? tooltipItems[1].raw : 0;

                            if (valCurr > 0 && valPrev > 0) {
                                const diff = valCurr - valPrev;
                                const sign = diff > 0 ? '+' : '';
                                return `\nVar. Nominal: ${sign}$${new Intl.NumberFormat('es-AR').format(Math.round(diff))} M`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                },
                y: {
                    grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                    ticks: {
                        color: '#64748b',
                        callback: val => '$' + new Intl.NumberFormat('es-AR').format(Math.round(val)) + ' M'
                    }
                }
            },
            interaction: { mode: 'index', intersect: false },
        }
    });
}

// --- Navigation Toggle ---
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('navMenuMobile');

    if (toggle && menu) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.classList.toggle('open');
            menu.classList.toggle('show');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (menu.classList.contains('show') && !menu.contains(e.target) && e.target !== toggle) {
                menu.classList.remove('show');
                toggle.classList.remove('open');
            }
        });

        // Close on link click
        const links = menu.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('show');
                toggle.classList.remove('open');
            });
        });
    }
});
