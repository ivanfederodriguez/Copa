
document.addEventListener('DOMContentLoaded', () => {
    fetch('dashboard_data.json')
        .then(response => response.json())
        .then(data => {
            renderKPIs(data.kpi);
            renderCharts(data.charts);
        })
        .catch(error => console.error('Error loading data:', error));
});

function formatCurrency(value) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

function formatPercentage(value) {
    const sign = value >= 0 ? '+' : '';
    const formattedValue = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return `${sign}${formattedValue}%`;
}

function formatNumber(value) {
    return new Intl.NumberFormat('es-AR').format(value);
}

function formatDecimal(value, digits = 2) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function renderKPIs(kpi) {
    // kpi-avg-salary
    document.getElementById('kpi-avg-salary').textContent = formatCurrency(kpi.salario_promedio);

    // kpi-employees (Shown as subtext)
    document.getElementById('kpi-employees').textContent = `Empleados: ${formatNumber(kpi.empleados)} | ${kpi.periodo_actual}`;

    // kpi-total-wage
    document.getElementById('kpi-total-wage').textContent = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
    }).format(kpi.masa_salarial) + ' M';

    // kpi-nom-var
    const nomVarEl = document.getElementById('kpi-nom-var');
    nomVarEl.textContent = formatPercentage(kpi.var_nominal_ia);
    nomVarEl.className = `kpi-value ${kpi.var_nominal_ia >= 0 ? 'text-success' : 'text-danger'}`;
    document.getElementById('label-nom-period').textContent = `vs ${kpi.periodo_anterior}`;

    // kpi-real-var
    const realVarEl = document.getElementById('kpi-real-var');
    realVarEl.textContent = formatPercentage(kpi.var_real_ia);
    realVarEl.className = `kpi-value ${kpi.var_real_ia >= 0 ? 'text-success' : 'text-danger'}`;
    document.getElementById('label-real-period').innerHTML = `Ajustado por IPC NEA (Estimado)<br>vs ${kpi.periodo_anterior}`;

    // Update Header Period
    document.getElementById('header-period').textContent = `Análisis de puestos de trabajo y masa salarial | ${kpi.periodo_actual}`;

    // --- Section 2: CBT ---

    // Update CBT Label with current date
    const cbtLabel = document.querySelector('#kpi-cbt-val').previousElementSibling;
    if (cbtLabel) cbtLabel.textContent = `Valor CBT (${kpi.periodo_actual})`;

    // kpi-cbt-val (Now a main value)
    document.getElementById('kpi-cbt-val').textContent = formatCurrency(kpi.cbt_valor);

    // kpi-cbt-ratio
    const cbtRatioEl = document.getElementById('kpi-cbt-ratio');
    cbtRatioEl.textContent = formatDecimal(kpi.cbt_ratio);
    cbtRatioEl.className = `kpi-value ${kpi.cbt_ratio >= 1.5 ? 'text-success' : 'text-danger'}`;
}

function renderCharts(charts) {
    // Common Color Palette
    const colorPrimary = '#22C55E'; // Brand Green
    const colorSecondary = '#64748b'; // Slate
    const colorAccent = '#E91E63'; // Magenta for contrast (e.g. IPC)
    const colorRipte = '#03A9F4'; // Blue for RIPTE

    // Chart 1: Avg Salary vs RIPTE
    const ctx1 = document.getElementById('chartAvgVsRipte').getContext('2d');
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: charts.labels,
            datasets: [
                {
                    label: 'Salario Promedio Provincial',
                    data: charts.salario_promedio,
                    borderColor: colorPrimary,
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'RIPTE (Nacional)',
                    data: charts.ripte_valor,
                    borderColor: colorRipte,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 4,
                    tension: 0.3,
                    yAxisID: 'y' // Assuming comparable magnitudes
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
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                y: {
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => new Intl.NumberFormat('es-AR', { notation: "compact", style: 'currency', currency: 'ARS' }).format(value).replace('.0', '')
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });


}

// --- Navigation Toggle ---
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');

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
