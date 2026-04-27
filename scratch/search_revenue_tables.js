const { Pool } = require('pg');
const databases = ['datos_tablero', 'datalake_economico'];

const search = async () => {
    for (const db of databases) {
        const pool = new Pool({
            host: '149.50.145.182',
            port: 5432,
            user: 'IPECD_Matias',
            password: 'IPECDatos.2026',
            database: db
        });
        
        try {
            const res = await pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND (
                    table_name ILIKE '%recurso%' 
                    OR table_name ILIKE '%provincial%' 
                    OR table_name ILIKE '%municipal%'
                    OR table_name ILIKE '%rop%'
                    OR table_name ILIKE '%bruto%'
                    OR table_name ILIKE '%neto%'
                    OR table_name ILIKE '%copa%'
                    OR table_name ILIKE '%ingresos%'
                )
            `);
            console.log(`DB: ${db}`);
            console.log(res.rows.map(r => r.table_name));
        } catch (err) {
            console.error(`Error in ${db}:`, err.message);
        } finally {
            await pool.end();
        }
    }
};

search();
