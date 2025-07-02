// server.js
const express = require('express');
require('dotenv').config();
const { sql, pool, poolConnect, GetMethod } = require('./db');

const app = express();
const PORT = parseInt(process.env.PORT, 10);

// Test 
app.get('/test-db', async (req, res) => {
    try {
        const result = await GetMethod('SELECT * From Users');
        res.status(200).json({
            success: true,
            message: 'Database connection successful',
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: err.message
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
