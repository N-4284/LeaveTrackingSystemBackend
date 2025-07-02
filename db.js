require('dotenv').config(); // Load environment variables

const sql = require('mssql');

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const pool = new sql.ConnectionPool(sqlConfig);
const poolConnect = pool.connect();

const GetMethod = async (query) => {
    try {
        await poolConnect;
        const result = await pool.request().query(query);
        return result;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
};

module.exports = {
    sql,
    pool,
    poolConnect,
    GetMethod
};
