const express = require('express');
const router = express.Router();
const db = require('../db_datalake');
const authMiddleware = require('../middleware/auth');

/**
 * Adaptador de Compatibilidad para el Monitor Anual.
 * Genera la estructura de _data_ipce_v1.json dinámicamente desde SQL.
 */
router.get('/annual-monitor', authMiddleware, async (req, res) => {
    try {
        // Consultamos RON y Personal para armar el monitor cruzado
        const ronResult = await db.query('SELECT * FROM v_ron_mensual_completo ORDER BY anio DESC, mes DESC');
        const personalResult = await db.query('SELECT * FROM v_analisis_personal_completo ORDER BY anio DESC, mes DESC');
        
        if (ronResult.rows.length === 0) {
            return res.status(404).json({ message: 'No hay datos disponibles' });
        }

        const years = [...new Set(ronResult.rows.map(r => parseInt(r.anio)))];
        const annual_data = {};

        for (const year of years) {
            // Datos del año actual (YTD)
            const currRows = ronResult.rows.filter(r => parseInt(r.anio) === year);
            const maxMonth = Math.max(...currRows.map(r => parseInt(r.mes)));
            
            // Datos del año anterior recortados al mismo mes (para comparación justa)
            const prevRows = ronResult.rows.filter(r => parseInt(r.anio) === year - 1 && parseInt(r.mes) <= maxMonth);
            
            // Sumas RON
            const ronBrutoCurr = currRows.reduce((sum, r) => sum + parseFloat(r.ron_bruto), 0);
            const ronBrutoPrev = prevRows.reduce((sum, r) => sum + parseFloat(r.ron_bruto), 0);
            const ronNetoCurr = currRows.reduce((sum, r) => sum + parseFloat(r.ron_neto), 0);
            const ronNetoPrev = prevRows.reduce((sum, r) => sum + parseFloat(r.ron_neto), 0);

            // Sumas Masa Salarial (Personal)
            const persCurrRows = personalResult.rows.filter(r => parseInt(r.anio) === year);
            const persPrevRows = personalResult.rows.filter(r => parseInt(r.anio) === year - 1 && parseInt(r.mes) <= maxMonth);
            
            const masaCurr = persCurrRows.reduce((sum, r) => sum + parseFloat(r.masa_salarial), 0);
            const masaPrev = persPrevRows.reduce((sum, r) => sum + parseFloat(r.masa_salarial), 0);

            // Variaciones RON
            const varNomRon = ronNetoPrev > 0 ? (ronNetoCurr / ronNetoPrev) - 1 : 0;
            const avgIpcCurr = currRows.reduce((sum, r) => sum + (parseFloat(r.ipc_valor) || 0), 0) / currRows.length;
            const avgIpcPrev = prevRows.reduce((sum, r) => sum + (parseFloat(r.ipc_valor) || 0), 0) / prevRows.length;
            const varRealRon = (varNomRon + 1) / (avgIpcCurr / avgIpcPrev) - 1;

            // Ordenamos cronológicamente para los gráficos y acumulados
            const ronRowsAsc = [...currRows].reverse();
            const ronPrevRowsAsc = [...prevRows].reverse();
            const persRowsAsc = [...persCurrRows].reverse();

            annual_data[year] = {
                kpi: {
                    meta: {
                        periodo: `${year} (YTD)`,
                        max_month: maxMonth,
                        is_complete: maxMonth === 12
                    },
                    recaudacion: {
                        current: ronNetoCurr,
                        prev: ronNetoPrev,
                        bruta_current: ronBrutoCurr,
                        bruta_prev: ronBrutoPrev,
                        neta_current: ronNetoCurr,
                        neta_prev: ronNetoPrev,
                        diff_nom: ronNetoCurr - ronNetoPrev,
                        var_nom: varNomRon * 100,
                        var_real: varRealRon * 100
                    },
                    masa_salarial: {
                        current: masaCurr,
                        prev: masaPrev,
                        cobertura_current: (masaCurr / ronNetoCurr) * 100,
                        cobertura_prev: (masaPrev / ronNetoPrev) * 100,
                        var_nom: masaPrev > 0 ? ((masaCurr / masaPrev) - 1) * 100 : 0
                    }
                },
                charts: {
                    monthly: {
                        labels: ronRowsAsc.map(r => String(r.mes)),
                        data_curr: ronRowsAsc.map(r => parseFloat(r.ron_neto)),
                        data_prev: ronPrevRowsAsc.map(r => parseFloat(r.ron_neto))
                    },
                    copa_vs_salario: {
                        labels: ronRowsAsc.map(r => String(r.mes)),
                        cumulative_copa: ronRowsAsc.map((_, i, arr) => 
                            arr.slice(0, i + 1).reduce((s, x) => s + parseFloat(x.ron_neto), 0)
                        ),
                        salario_target: persRowsAsc.map((_, i, arr) => 
                            arr.slice(0, i + 1).reduce((s, x) => s + parseFloat(x.masa_salarial), 0)
                        )
                    }
                }
            };
        }

        res.json({
            annual_monitor: {
                meta: {
                    default_period_id: String(years[0]),
                    available_periods: years.map(y => ({ id: String(y), label: String(y), year: y }))
                },
                data: annual_data
            }
        });
    } catch (err) {
        console.error('Error al generar monitor anual:', err.message);
        res.status(500).json({ message: 'Error al obtener datos' });
    }
});

module.exports = router;
