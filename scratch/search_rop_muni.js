const { Pool } = require('pg');

const search = async () => {
    const pool = new Pool({
        host: '149.50.145.182',
        port: 5432,
        user: 'IPECD_Matias',
        password: 'IPECDatos.2026',
        database: 'datalake_economico'
    });
    
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND (table_name ILIKE '%recurso%' OR table_name ILIKE '%rop%' OR table_name ILIKE '%muni%' OR table_name ILIKE '%provincial%')
        `);
        console.log('Tables:', res.rows.map(r => r.table_name));
        
        const resViews = await pool.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
        `);
        console.log('Views:', resViews.rows.map(r => r.table_name));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
};

search();
