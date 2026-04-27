const express = require('express');
const router = express.Router();
const db = require('../db'); // datos_tablero
const authMiddleware = require('../middleware/auth');

/**
 * Obtiene el resumen de gastos agrupados.
 * Soporta filtros por jurisdicción, partida, fuente y estado.
 */
router.get('/resumen', authMiddleware, async (req, res) => {
    try {
        const { jurisdiccion, partida, fuente, estado } = req.query;
        
        let query = 'SELECT * FROM v_gastos_agrupados WHERE 1=1';
        const params = [];

        if (jurisdiccion) {
            params.push(jurisdiccion);
            query += ` AND jurisdiccion = $${params.length}`;
        }
        if (partida) {
            params.push(partida);
            query += ` AND partida = $${params.length}`;
        }
        if (fuente) {
            params.push(fuente);
            query += ` AND fuente = $${params.length}`;
        }
        if (estado) {
            params.push(estado);
            query += ` AND estado = $${params.length}`;
        }

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al consultar gastos:', err.message);
        res.status(500).json({ message: 'Error al obtener datos de gastos' });
    }
});

/**
 * Obtiene las opciones únicas para los filtros.
 */
router.get('/filtros', authMiddleware, async (req, res) => {
    try {
        const jurisdicciones = await db.query('SELECT DISTINCT jurisdiccion FROM v_gastos_agrupados ORDER BY 1');
        const partidas = await db.query('SELECT DISTINCT partida FROM v_gastos_agrupados ORDER BY 1');
        const fuentes = await db.query('SELECT DISTINCT fuente FROM v_gastos_agrupados ORDER BY 1');
        const estados = await db.query('SELECT DISTINCT estado FROM v_gastos_agrupados ORDER BY 1');

        res.json({
            jurisdicciones: jurisdicciones.rows.map(r => r.jurisdiccion),
            partidas: partidas.rows.map(r => r.partida),
            fuentes: fuentes.rows.map(r => r.fuente),
            estados: estados.rows.map(r => r.estado)
        });
    } catch (err) {
        console.error('Error al obtener filtros de gastos:', err.message);
        res.status(500).json({ message: 'Error al obtener opciones de filtros' });
    }
});

/**
 * Obtiene todos los registros de gastos para el dashboard.
 * Formateado como el antiguo gasto_data.json
 */
router.get('/all-data', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                TO_CHAR(periodo, 'YYYY-MM') as periodo, 
                jurisdiccion, 
                tipo_financ, 
                partida, 
                estado, 
                monto 
            FROM copa_gastos 
            ORDER BY periodo DESC
        `);
        
        // El frontend espera un array de objetos GastoRow
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener todos los gastos:', err.message);
        res.status(500).json({ message: 'Error al obtener datos' });
    }
});

module.exports = router;
