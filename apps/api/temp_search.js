const { Pool } = require('pg');

const search = async () => {
    const pool = new Pool({
        host: '149.50.145.182', port: 5432, user: 'IPECD_Matias', password: 'IPECDatos.2026', database: 'datos_tablero'
    });
    try {
        const res = await pool.query("SELECT DISTINCT EXTRACT(year FROM periodo) as anio FROM copa_gastos");
        console.log('Years in copa_gastos:', res.rows.map(r => r.anio));
    } finally { await pool.end(); }
};
search();
