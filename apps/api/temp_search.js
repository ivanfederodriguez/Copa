const { Pool } = require('pg');

const search = async () => {
    const pool = new Pool({
        host: '149.50.145.182', port: 5432, user: 'IPECD_Matias', password: 'IPECDatos.2026', database: 'datos_tablero'
    });
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'copa_recursos_origen_nacional'");
        console.log('Columns:', res.rows.map(r => r.column_name));
    } finally { await pool.end(); }
};
search();
