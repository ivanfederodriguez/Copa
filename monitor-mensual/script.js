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
        option.textContent = period.label;
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

    // Update KPI Grid
    renderKPIs(periodData.kpi);

    // Update Header Text for clarity (Optional, but good UX)
    // The h1 says "Enero 2026", we might want to update it or leave it generic?
    // User requested selector, not changing header. But "Analisis Enero 2026" looks static.
    // Let's check index.html content. It has <h1>Coparticipación... - Analisis Enero 2026</h1>
    // We should probably update that too if we want true dynamic behavior.
    // Update Header Text
    const headerTitle = document.querySelector('h1.text-gradient');
    if (headerTitle) {
        headerTitle.textContent = `Coparticipación Federal - Análisis ${periodData.kpi.meta.periodo}`;
    }

    // Extract month name for other labels (e.g. "Enero 2026" -> "Enero")
    const periodLabel = periodData.kpi.meta.periodo; // "Enero 2026"
    const monthName = periodLabel.split(' ')[0]; // "Enero"

    // Update Main Subtitle
    const mainSubtitle = document.getElementById('main-subtitle');
    if (mainSubtitle) {
        mainSubtitle.textContent = `Análisis comparativo del comportamiento de transferencias nacionales (CFI Neta de Ley 26075) para el período ${monthName} 2025 vs ${monthName} 2026.`;
    }

    // Update Recaudación Labels
    const lblRecCurrent = document.getElementById('label-recaudacion-current');
    if (lblRecCurrent) lblRecCurrent.textContent = `Recaudación ${monthName} 2026`;

    const lblRecPrev = document.getElementById('label-recaudacion-prev');
    if (lblRecPrev) lblRecPrev.textContent = `Recaudación ${monthName} 2025`;

    // Update Masa Salarial Subtitle
    const masaSubtitle = document.getElementById('masa-salarial-subtitle');
    if (masaSubtitle) {
        masaSubtitle.textContent = `Relación entre Coparticipación y Masa Salarial para ${monthName} 2025 vs 2026`;
    }

    // Update Masa Salarial Labels
    const lblMasaCurrent = document.getElementById('label-masa-current');
    if (lblMasaCurrent) lblMasaCurrent.textContent = `Masa Salarial ${monthName} 2026`;

    const lblMasaPrev = document.getElementById('label-masa-prev');
    if (lblMasaPrev) lblMasaPrev.textContent = `Masa Salarial ${monthName} 2025`;

    // Update Chart Title
    const chartTitle = document.getElementById('chart-title');
    if (chartTitle) chartTitle.textContent = `Comportamiento Diario ${monthName}`;

    // Update Chart
    // Destroy existing chart instance if exists? Chart.js usually needs that or update().
    // We didn't keep reference globally. Let's modify renderChart to handle existing instance.
    renderChart(periodData.charts.daily, periodData.kpi.meta.periodo);
}

// ... Format functions remain same ...
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
    const formattedValue = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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

    // Var Real
    const recVarRealEl = document.getElementById('real-var-val');
    recVarRealEl.textContent = formatPercentage(kpi.recaudacion.var_real);
    recVarRealEl.className = `kpi-value ${kpi.recaudacion.var_real >= 0 ? 'text-success' : 'text-secondary'}`;
    if (kpi.recaudacion.var_real < 0) recVarRealEl.classList.add('text-danger');


    // --- Masa Salarial ---
    document.getElementById('kpi-masa-current').textContent = formatMillions(kpi.masa_salarial.current);
    document.getElementById('kpi-masa-prev').textContent = formatMillions(kpi.masa_salarial.prev);

    // Cobertura text
    document.getElementById('kpi-masa-cob-current').textContent = `Cobertura: ${kpi.masa_salarial.cobertura_current.toFixed(2)}%`;
    document.getElementById('kpi-masa-cob-prev').textContent = `Cobertura: ${kpi.masa_salarial.cobertura_prev.toFixed(2)}%`;

    // Var Nominal Masa
    const masaVarNomEl = document.getElementById('kpi-masa-var-nom');
    const masaDiffSign = kpi.masa_salarial.diff_nom >= 0 ? '+' : '';
    masaVarNomEl.textContent = masaDiffSign + formatMillions(Math.abs(kpi.masa_salarial.diff_nom));
    masaVarNomEl.className = `kpi-value ${kpi.masa_salarial.diff_nom >= 0 ? 'text-success' : 'text-danger'}`;

    const masaVarNomSub = document.getElementById('kpi-masa-var-nom-pct');
    masaVarNomSub.textContent = (kpi.masa_salarial.var_nom >= 0 ? '▲ ' : '▼ ') + formatPercentage(kpi.masa_salarial.var_nom).replace('+', '');

    // Var Real Masa
    const masaVarRealEl = document.getElementById('kpi-masa-var-real');
    masaVarRealEl.textContent = formatPercentage(kpi.masa_salarial.var_real);
    masaVarRealEl.className = `kpi-value ${kpi.masa_salarial.var_real >= 0 ? 'text-success' : 'text-danger'}`;
}

let dailyChartInstance = null;

function renderChart(dailyData, periodLabel) {
    const ctx = document.getElementById('dailyChart').getContext('2d');

    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }

    // Extract month name from "Enero 2026" -> "Enero"
    const monthName = periodLabel.split(' ')[0];

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
                    label: `${monthName} 2026`,
                    data: dailyData.data_2026,
                    backgroundColor: gradient2026,
                    borderRadius: 4,
                    borderSkipped: false,
                    order: 1
                },
                {
                    label: `${monthName} 2025`,
                    data: dailyData.data_2025_nom,
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
                            const val2026 = tooltipItems[0].raw || 0;
                            const val2025 = tooltipItems[1] ? tooltipItems[1].raw : 0;
                            // Checking index 0/1 is risky if order changes, finding by dataset label label is safer but dynamic now.
                            // Simply calculating diff if both exist.

                            if (val2026 > 0 && val2025 > 0) {
                                const diff = val2026 - val2025;
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
