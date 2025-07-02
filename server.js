// server.js
const express = require('express');
require('dotenv').config();
const { sql, pool, poolConnect, GetMethod } = require('./db');
const cors = require('cors');


const app = express();
app.use(cors());
app.use(express.json());
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

app.post('/Login', async(req, res) => {
    try{
        const { username, password } = req.body;
        const query = `SELECT * FROM Users WHERE name = @name AND hashedPassword = @hashedPassword`;
        const result = await pool.request()
            .input('name', sql.VarChar, username)
            .input('hashedPassword', sql.VarChar, password)
            .query(query);
        
        if (result.recordset.length > 0) {
            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result.recordset[0]
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
    }
    catch (err) {
        console.error('SQL error', err);
        res.status(500).json({
            success: false,
            message: 'Database query failed',
            error: err.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
