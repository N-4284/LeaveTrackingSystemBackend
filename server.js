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

app.get('/Attendance', async (req,res) =>{
    try{
        const result = await GetMethod('SELECT a.attendanceID, a.userID, a.date, lt.leaveTypeName AS status FROM Attendance AS a JOIN LeaveTypes lt ON a.attendanceStatusID = lt.leaveTypeID ORDER BY a.date DESC');
        res.json(result.recordset);
    }catch (err){
        console.error('Error fetching Attendance:', err);
        res.status(500).send('Failed to get Attendance');
    }
    
});

app.post('/Attendance', async (req, res) => {
    const { userId, date, attendanceStatusId } = req.body;

    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('userID', sql.Int, userId)
            .input('date', sql.Date, date)
            .input('attendanceStatusID', sql.Int, attendanceStatusId)
            .execute('AddAttendance');

        res.status(201).json({ message: 'Attendance marked successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to mark attendance.' });
    }
});





app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
