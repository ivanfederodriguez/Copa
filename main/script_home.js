
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
    // 1. Evolución Real Coparticipación (Main)
    const currentPeriodId = mainData.meta.default_period_id; // '2026-01'
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
        el.textContent = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kpiCbtRatio);
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

    const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Var. Interanual Coparticipación (%)',
                    data: chartData.copa_var_interanual,
                    backgroundColor: '#10b981', // Brand Green
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'Inflación Interanual (%)',
                    data: chartData.ipc_var_interanual,
                    backgroundColor: '#94a3b8', // Slate Gray
                    borderColor: '#94a3b8',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#64748b', font: { weight: '600' } }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: val => val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}
