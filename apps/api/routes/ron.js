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
            
            // Sumas RON (Convertimos a MILLONES para compatibilidad con el frontend)
            const SCALE = 1000000;
            const ronBrutoCurr = currRows.reduce((sum, r) => sum + parseFloat(r.ron_bruto), 0) / SCALE;
            const ronBrutoPrev = prevRows.reduce((sum, r) => sum + parseFloat(r.ron_bruto), 0) / SCALE;
            const ronNetoCurr = currRows.reduce((sum, r) => sum + parseFloat(r.ron_neto), 0) / SCALE;
            const ronNetoPrev = prevRows.reduce((sum, r) => sum + parseFloat(r.ron_neto), 0) / SCALE;

            // Sumas Masa Salarial (Personal)
            const persCurrRows = personalResult.rows.filter(r => parseInt(r.anio) === year);
            const persPrevRows = personalResult.rows.filter(r => parseInt(r.anio) === year - 1 && parseInt(r.mes) <= maxMonth);
            
            const masaCurr = persCurrRows.reduce((sum, r) => sum + parseFloat(r.masa_salarial), 0) / SCALE;
            const masaPrev = persPrevRows.reduce((sum, r) => sum + parseFloat(r.masa_salarial), 0) / SCALE;

            // Variaciones RON
            const varNomRon = ronNetoPrev > 0 ? (ronNetoCurr / ronNetoPrev) - 1 : 0;
            const avgIpcCurr = currRows.reduce((sum, r) => sum + (parseFloat(r.ipc_valor) || 0), 0) / currRows.length;
            const avgIpcPrev = prevRows.reduce((sum, r) => sum + (parseFloat(r.ipc_valor) || 0), 0) / prevRows.length;
            const varRealRon = (avgIpcPrev > 0 && avgIpcCurr > 0) ? ((varNomRon + 1) / (avgIpcCurr / avgIpcPrev) - 1) : 0;

            // Ordenamos cronológicamente para los gráficos y acumulados
            const ronRowsAsc = [...currRows].reverse();
            const ronPrevRowsAsc = [...prevRows].reverse();
            const persRowsAsc = [...persCurrRows].reverse();

            // ROP y Municipal (Datos no encontrados en BD, usamos placeholders para habilitar las cards)
            // TODO: Localizar tablas de ROP y Distribución Municipal
            const ropBrutaCurr = 0;
            const ropBrutaPrev = 0;
            const muniNatCurr = 0;
            const muniNatPrev = 0;
            const muniProvCurr = 0;
            const muniProvPrev = 0;

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
                        disponible_current: ronNetoCurr,
                        disponible_prev: ronNetoPrev,
                        diff_nom: ronNetoCurr - ronNetoPrev,
                        var_nom: varNomRon * 100,
                        var_real: varRealRon * 100
                    },
                    rop: {
                        bruta_current: ropBrutaCurr,
                        bruta_prev: ropBrutaPrev,
                        disponible_current: ropBrutaCurr, 
                        disponible_prev: ropBrutaPrev,
                        var_nom: 0,
                        var_real: 0,
                        diff_nom: 0
                    },
                    distribucion_municipal: {
                        current: muniNatCurr + muniProvCurr,
                        prev: muniNatPrev + muniProvPrev,
                        nacion_current: muniNatCurr,
                        nacion_prev: muniNatPrev,
                        provincia_current: muniProvCurr,
                        provincia_prev: muniProvPrev,
                        var_nom: 0,
                        var_real: 0,
                        diff_nom: 0
                    },
                    masa_salarial: {
                        current: masaCurr,
                        prev: masaPrev,
                        cobertura_current: ronNetoCurr > 0 ? (masaCurr / ronNetoCurr) * 100 : 0,
                        cobertura_prev: ronNetoPrev > 0 ? (masaPrev / ronNetoPrev) * 100 : 0,
                        var_nom: masaPrev > 0 ? ((masaCurr / masaPrev) - 1) * 100 : 0,
                        diff_nom: masaCurr - masaPrev
                    }
                },
                charts: {
                    monthly: {
                        labels: ronRowsAsc.map(r => String(r.mes)),
                        data_curr: ronRowsAsc.map(r => parseFloat(r.ron_neto) / SCALE),
                        data_prev: ronPrevRowsAsc.map(r => parseFloat(r.ron_neto) / SCALE)
                    },
                    copa_vs_salario: {
                        labels: ronRowsAsc.map(r => String(r.mes)),
                        cumulative_copa: ronRowsAsc.map((_, i, arr) => 
                            arr.slice(0, i + 1).reduce((s, x) => s + parseFloat(x.ron_neto), 0) / SCALE
                        ),
                        salario_target: persRowsAsc.map((_, i, arr) => 
                            arr.slice(0, i + 1).reduce((s, x) => s + parseFloat(x.masa_salarial), 0) / SCALE
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
