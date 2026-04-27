const express = require('express');
const router = express.Router();
const db = require('../db_datalake');
const authMiddleware = require('../middleware/auth');
const { getIpcProjections } = require('../services/projections');

/**
 * Retorna los datos de empleo público directamente desde la base de datos (vistas).
 * Formateado para ser compatible con AnalisisPersonalDashboard.tsx
 */
router.get('/masa-salarial', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM v_analisis_personal_completo ORDER BY anio DESC, mes DESC');
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No hay datos disponibles' });
        }

        // --- Lógica de Proyecciones ---
        const lastWithIpc = result.rows.find(r => r.ipc_valor !== null);
        let finalDataRows = [...result.rows];

        if (lastWithIpc) {
            const projections = await getIpcProjections(
                parseInt(lastWithIpc.anio), 
                parseInt(lastWithIpc.mes), 
                parseFloat(lastWithIpc.ipc_valor)
            );

            // Inyectamos las proyecciones en las filas que no tienen IPC
            finalDataRows = finalDataRows.map(row => {
                const proj = projections.find(p => p.anio === parseInt(row.anio) && p.mes === parseInt(row.mes));
                if (proj && row.ipc_valor === null) {
                    // Recalculamos la variación real usando el IPC proyectado
                    const var_real_ia = row.salario_promedio_anterior > 0 && proj.ipc_valor > 0 
                        ? ((row.salario_promedio / row.salario_promedio_anterior) / (proj.ipc_valor / row.ipc_valor_anterior)) - 1
                        : null;
                        
                    return { ...row, ipc_valor: proj.ipc_valor, var_real_ia, is_projection: true };
                }
                return row;
            });
        }

        const MONTH_NAMES = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
            7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        };

        const available_periods = finalDataRows.map(row => ({
            id: `${row.anio}-${String(row.mes).padStart(2, '0')}`,
            label: MONTH_NAMES[row.mes],
            year: parseInt(row.anio),
            incomplete: row.is_projection
        }));

        const data_by_period = {};
        
        finalDataRows.forEach((row, index) => {
            const period_id = `${row.anio}-${String(row.mes).padStart(2, '0')}`;
            const window = finalDataRows.slice(index, index + 12).reverse();
            
            data_by_period[period_id] = {
                kpi: {
                    masa_salarial: parseFloat(row.masa_salarial) / 1000000,
                    salario_promedio: parseFloat(row.salario_promedio),
                    empleados: parseInt(row.cantidad_empleados),
                    var_nominal_ia: parseFloat(row.var_nominal_ia) * 100,
                    var_real_ia: row.var_real_ia != null ? parseFloat(row.var_real_ia) * 100 : null,
                    cbt_valor: row.cbt_nea != null ? parseFloat(row.cbt_nea) : null,
                    cbt_ratio: row.cbt_ratio != null ? parseFloat(row.cbt_ratio) : null,
                    periodo_actual: `${MONTH_NAMES[row.mes]} ${row.anio}`,
                    periodo_anterior: `el mismo mes del año anterior`,
                    is_incomplete: row.is_projection || false
                },
                charts: {
                    labels: window.map(w => `${MONTH_NAMES[w.mes].substring(0,3)} ${String(w.anio).substring(2)}`),
                    salario_promedio: window.map(w => parseFloat(w.salario_promedio)),
                    ripte_valor: window.map(() => null) 
                }
            };
        });

        res.json({
            meta: {
                default_period_id: available_periods[0].id,
                available_periods: available_periods
            },
            data: data_by_period
        });
    } catch (err) {
        console.error('Error al consultar vista de masa salarial:', err.message);
        res.status(500).json({ message: 'Error al obtener datos de la base de datos' });
    }
});

module.exports = router;
