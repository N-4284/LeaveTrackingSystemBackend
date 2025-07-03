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
    const { userID, date } = req.body;  //date format should be YYYY-MM-DD

    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0];

    if (formattedDate !== date) {
        return res.status(400).json({ error: 'Your Systems date is Invalid.'});
    }

    try {
        await pool.request()
            .input('userID', sql.Int, userID)
            .input('date', sql.Date, date)
            .input('attendanceStatusID', sql.Int, 1) //Logging attendance as 'Present' others are done through request confirmation by higher ups
            .execute('AddAttendance');

        res.status(201).json({ message: 'Attendance marked successfully.' });
    } catch (error) {
        if (error && (error.number === 2627 || error.number === 2601)) {
            return res.status(409).json({ error: 'Attendance already Set (For any correction contact Manager or put in a request)' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to mark attendance.'});
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
