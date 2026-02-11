
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    const isAuthenticated = Auth.isAuthenticated();
    const currentUser = isAuthenticated ? Auth.getCurrentUser() : null;

    // Elements for conditional display
    const btnHeaderLogin = document.getElementById('btnHeaderLogin');
    const navUserHeader = document.getElementById('navUserHeader');
    const navUserMobile = document.getElementById('navUserMobile');

    // Dashboard links (desktop)
    const navMonitor = document.getElementById('navMonitor');
    const navAnual = document.getElementById('navAnual');
    const navPersonal = document.getElementById('navPersonal');

    // Dashboard links (mobile)
    const navMonitorMobile = document.getElementById('navMonitorMobile');
    const navAnualMobile = document.getElementById('navAnualMobile');
    const navPersonalMobile = document.getElementById('navPersonalMobile');

    if (isAuthenticated && currentUser) {
        // User is logged in - show user info and all dashboard links

        // Hide login button
        if (btnHeaderLogin) btnHeaderLogin.style.display = 'none';

        // Show user info (desktop)
        if (navUserHeader) {
            navUserHeader.style.display = 'flex';
            const userNameEl = navUserHeader.querySelector('#userName');
            if (userNameEl) userNameEl.textContent = currentUser.name;
        }

        // Show user info (mobile)
        if (navUserMobile) {
            navUserMobile.style.display = 'flex';
            const userNameMobileEl = navUserMobile.querySelector('#userNameMobile');
            if (userNameMobileEl) userNameMobileEl.textContent = currentUser.name;
        }

        // Show all dashboard links (desktop)
        if (navMonitor) navMonitor.style.display = 'block';
        if (navAnual) navAnual.style.display = 'block';
        if (navPersonal) navPersonal.style.display = 'block';

        // Show all dashboard links (mobile)
        if (navMonitorMobile) navMonitorMobile.style.display = 'block';
        if (navAnualMobile) navAnualMobile.style.display = 'block';
        if (navPersonalMobile) navPersonalMobile.style.display = 'block';

        // Setup logout handlers
        const btnLogout = document.getElementById('btnLogout');
        const btnLogoutMobile = document.getElementById('btnLogoutMobile');

        const handleLogout = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('¿Está seguro que desea cerrar sesión?')) {
                Auth.logout();
            }
        };

        if (btnLogout) btnLogout.addEventListener('click', handleLogout);
        if (btnLogoutMobile) btnLogoutMobile.addEventListener('click', handleLogout);
    } else {
        // User is NOT logged in - show only login button

        // Show login button
        if (btnHeaderLogin) btnHeaderLogin.style.display = 'flex';

        // Hide user info
        if (navUserHeader) navUserHeader.style.display = 'none';
        if (navUserMobile) navUserMobile.style.display = 'none';

        // Hide all protected dashboard links (keep them hidden with inline style)
        // They are already hidden by default in the HTML
    }

    // Load dashboard data
    Promise.all([
        fetch('dashboard_data.json').then(res => res.json()),
        fetch('../analisis-personal/dashboard_data.json').then(res => res.json())
    ])
        .then(([mainData, personalData]) => {
            renderKPIs(mainData, personalData);
            renderChart(mainData);
            renderSecondaryCharts(mainData);
        })
        .catch(error => console.error('Error loading dashboard data:', error));

    // Mobile nav toggle logic
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('navMenuMobile');

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

function renderKPIs(mainData, personalData) {
    // 0. Update Main Title (Dynamic)
    const currentPeriodId = mainData.meta.default_period_id; // '2026-01'
    const [year, month] = currentPeriodId.split('-');

    // Find label for this period in available_periods if possible
    let periodLabel = 'Periodo';
    let periodYear = year;

    if (mainData.meta && mainData.meta.available_periods) {
        const periodObj = mainData.meta.available_periods.find(p => p.id === currentPeriodId);
        if (periodObj) {
            periodLabel = periodObj.label;
        }
    }

    const dashboardTitle = document.querySelector('.dashboard-title');
    if (dashboardTitle) {
        dashboardTitle.textContent = `Tablero Ejecutivo Provincial - ${periodLabel} ${periodYear}`;
    }

    // 1. Evolución Real Coparticipación (Main)
    const copaData = mainData.data[currentPeriodId].kpi.recaudacion;
    const kpiCopaReal = copaData.var_real;

    updateKPI('kpi-copa-var-real', kpiCopaReal, true);

    // 2. Cobertura Salarial (Main)
    const masaData = mainData.data[currentPeriodId].kpi.masa_salarial;
    const kpiCobertura = masaData.cobertura_current;

    updateKPI('kpi-cobertura', kpiCobertura, false, true);

    // 3. Variación Real Salario (Personal)
    const kpiSalarioReal = personalData.kpi.var_real_ia;
    updateKPI('kpi-salario-var-real', kpiSalarioReal, true);

    // 4. Ratio CBT (Personal)
    const kpiCbtRatio = personalData.kpi.cbt_ratio;
    const el = document.getElementById('kpi-cbt-ratio');
    if (el) {
        el.textContent = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(kpiCbtRatio);
        el.className = `kpi-value ${kpiCbtRatio >= 1.5 ? 'text-success' : 'text-danger'}`;
    }
}

function updateKPI(elementId, value, useColor = true, isCoverage = false) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (value === null || value === undefined) {
        el.textContent = '--';
        return;
    }

    const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const formatted = formatter.format(Math.abs(value)) + '%';
    const sign = value > 0 ? '+' : (value < 0 ? '-' : '');

    if (isCoverage) {
        el.textContent = formatter.format(value) + '%';
        el.className = 'kpi-value text-accent';
        return;
    }

    el.textContent = sign + formatted;

    if (useColor) {
        if (value > 0) el.className = 'kpi-value text-success';
        else if (value < 0) el.className = 'kpi-value text-danger';
        else el.className = 'kpi-value';
    }
}

function renderChart(mainData) {
    const ctx = document.getElementById('executiveChart').getContext('2d');
    const chartData = mainData.global_charts;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Var. Interanual Coparticipación (%)',
                    data: chartData.copa_var_interanual,
                    borderColor: '#10b981', // Brand Green
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false
                },
                {
                    label: 'Inflación Interanual (%)',
                    data: chartData.ipc_var_interanual,
                    borderColor: '#94a3b8', // Slate Gray
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#64748b',
                        font: { weight: '600' },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += Math.round(context.parsed.y) + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: val => val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '%' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderSecondaryCharts(mainData) {
    if (!mainData.secondary_charts) return;

    // --- Purchasing Power Chart ---
    const ppData = mainData.secondary_charts.purchasing_power;
    if (ppData) {
        const ctxPP = document.getElementById('purchasingPowerChart').getContext('2d');
        new Chart(ctxPP, {
            type: 'bar',
            data: {
                labels: ppData.labels,
                datasets: [{
                    label: 'Salarios Promedio / CBT NEA',
                    data: ppData.values,
                    backgroundColor: '#0ea5e9', // Sky Blue
                    borderWidth: 0,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.raw.toFixed(2) + ' CBTs';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: { display: true, text: 'Canastas' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // --- Coverage Chart ---
    const covData = mainData.secondary_charts.coverage;
    if (covData) {
        // Update subtitle
        const subtitle = document.getElementById('coverageSubtitle');
        if (subtitle && covData.period) {
            subtitle.textContent = `Masa Salarial vs Resto (${covData.period})`;
        }

        const ctxCov = document.getElementById('coverageChart').getContext('2d');
        new Chart(ctxCov, {
            type: 'doughnut',
            data: {
                labels: ['Masa Salarial', 'Resto Coparticipación'],
                datasets: [{
                    data: [covData.masa_salarial, covData.resto_copa],
                    backgroundColor: [
                        '#eab308', // Yellow (Wage Bill)
                        '#10b981'  // Green (Rest)
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.raw;
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const pct = ((val / total) * 100).toFixed(1);
                                return `${context.label}: ${pct}% ($${(val / 1000000).toFixed(0)}M)`;
                            }
                        }
                    }
                }
            }
        });
    }
}
