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
        const { email, password } = req.body;
        const query = `SELECT Users.*, Roles.roleName 
                    FROM Users 
                    JOIN Roles ON Users.roleID = Roles.roleID
                    WHERE Users.email = @email AND Users.hashedPassword = @hashedPassword
                `;

        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('hashedPassword', sql.VarChar, password)
            .query(query);
        
        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            res.status(200).json({
                success: true,
                message: 'Login successful',
                role: user.roleName           
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid Email or Password'
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

app.get('/MonthlyAttendance', async (req, res) => {
    const { month, year } = req.query;

    try {
        const result = await GetMethod(`
            SELECT a.userID, u.name, a.date, lt.leaveTypeName AS status
            FROM Attendance AS a
            JOIN Users AS u ON a.userID = u.userID
            JOIN LeaveTypes AS lt ON a.attendanceStatusID = lt.leaveTypeID
            WHERE MONTH(a.date) = ${month} AND YEAR(a.date) = ${year}
            ORDER BY a.userID, a.date
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching monthly attendance:', err);
        res.status(500).send('Failed to fetch monthly attendance');
    }
});

app.get('/LeaveRequest/My', async (req, res) =>{
    const { userID } = req.query;
    try {
        const result = await GetMethod(`
            SELECT lr.RequestID, lr.userID, u.name, lt.leaveTypeName, lr.startDate, lr.endDate, lr.reason, lr.processedStatusID, lr.submittedAt
            FROM LeaveRequests AS lr
            JOIN Users AS u ON lr.userID = u.userID
            JOIN LeaveTypes AS lt ON lr.leaveID = lt.leaveTypeID
            WHERE lr.userID = ${userID}
            ORDER BY lr.submittedAt DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching leave requests:', err);
        res.status(500).send('Failed to fetch leave requests');
    }
});

app.post('/LeaveRequestByName', async (req, res) => {
    const { name, leaveTypeName, startDate, endDate, reason } = req.body;

    try {
        await poolConnect;

        const userResult = await pool.request()
            .input('name', sql.VarChar, name)
            .query('SELECT userID FROM Users WHERE name = @name');

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        const userID = userResult.recordset[0].userID;

        const leaveResult = await pool.request()
            .input('leaveTypeName', sql.VarChar, leaveTypeName)
            .query('SELECT leaveTypeID FROM LeaveTypes WHERE leaveTypeName = @leaveTypeName');

        const leaveID = leaveResult.recordset[0].leaveTypeID;

        await pool.request()
            .input('userID', sql.Int, userID)
            .input('leaveID', sql.Int, leaveID)
            .input('startDate', sql.Date, startDate)
            .input('endDate', sql.Date, endDate)
            .input('reason', sql.NVarChar, reason)
            .input('processedStatusID', sql.Int, 0) 
            .query(`
                INSERT INTO LeaveRequests (userID, leaveID, startDate, endDate, reason, processedStatusID, submittedAt)
                VALUES (@userID, @leaveID, @startDate, @endDate, @reason, @processedStatusID, GETDATE())
            `);

        res.status(201).json({ message: 'Leave request submitted successfully.' });

    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ error: 'Failed to submit leave request.' });
    }
});


app.put('/LeaveRequest/Edit', async (req, res) => {
    try {
        const { leaveRequestID, leaveTypeName, startDate, endDate, reason } = req.body;

        if (!leaveRequestID || !leaveTypeName || !startDate || !endDate || !reason) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        await poolConnect;
        const leaveResult = await pool.request()
            .input('leaveTypeName', sql.VarChar, leaveTypeName)
            .query('SELECT leaveTypeID FROM LeaveTypes WHERE leaveTypeName = @leaveTypeName');

        if (leaveResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Leave type not found.' });
        }

        const leaveID = leaveResult.recordset[0].leaveTypeID;

        await pool.request()
            .input('leaveRequestID', sql.Int, leaveRequestID)
            .input('leaveID', sql.Int, leaveID)
            .input('startDate', sql.Date, startDate)
            .input('endDate', sql.Date, endDate)
            .input('reason', sql.VarChar, reason)
            .query(`
                UPDATE LeaveRequests
                SET leaveID = @leaveID, startDate = @startDate, endDate = @endDate, reason = @reason, submittedAt = GETDATE()
                WHERE requestID = @leaveRequestID AND processedStatusID = 0
            `);

        res.status(200).json({ message: 'Leave request updated successfully.' });
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).send('Failed to update leave request');
    }
});


app.delete('/LeaveRequest/Delete/:requestID', async (req, res) => {
    const { requestID } = req.params;

    try {
        const result = await pool.request()
            .input('requestID', sql.Int, requestID)
            .query(`
                DELETE FROM LeaveRequests
                WHERE requestID = @requestID AND processedStatusID = 0
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Request not found or cannot delete approved/denied requests.' });
        }

        res.json({ message: 'Leave request deleted successfully.' });
    } catch (error) {
        console.error('Error deleting leave request:', error);
        res.status(500).json({ error: 'Failed to delete leave request.' });
    }
});

app.get('/LeaveRequest', async (req, res) => {
    const { name } = req.query;

    try {
        await poolConnect;

        const managerResult = await pool.request()
            .input('name', sql.VarChar, name)
            .query(`SELECT userID, roleID FROM Users WHERE name = @name`);

        if (managerResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Manager not found.' });
        }

        const { userID: managerID, roleID } = managerResult.recordset[0];

        if (roleID !== 2) { 
            return res.status(403).json({ error: 'Unauthorized. Only managers can view this data.' });
        }

        const result = await GetMethod(`
            SELECT lr.RequestID, lr.userID, u.name, lt.leaveTypeName, lr.startDate, lr.endDate, lr.reason, lr.processedStatusID, lr.submittedAt
            FROM LeaveRequests AS lr
            JOIN Users AS u ON lr.userID = u.userID
            JOIN LeaveTypes AS lt ON lr.leaveID = lt.leaveTypeID
            WHERE u.managerID = ${managerID}
            ORDER BY lr.submittedAt DESC
        `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).send('Failed to fetch leave requests');
    }
});

app.put('/LeaveRequest/Process', async (req, res) => {
    const { requestID, statusName, approvedBy } = req.body; 

    try {
        await poolConnect;

        const statusResult = await pool.request()
            .input('statusName', sql.VarChar, statusName)
            .query(`SELECT processedStatusID FROM LeaveStatus WHERE statusName = @statusName`);

        if (statusResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Invalid status name.' });
        }

        const statusID = statusResult.recordset[0].processedStatusID;

        await pool.request()
            .input('requestID', sql.Int, requestID)
            .input('statusID', sql.Int, statusID)
            .input('approvedBy', sql.Int, approvedBy)
            .query(`
                UPDATE LeaveRequests
                SET processedStatusID = @statusID, ApprovedBy = @approvedBy, ProcessedAt = GETDATE()
                WHERE requestID = @requestID AND processedStatusID = 0
            `);

        res.json({ message: 'Leave request processed.' });
    } catch (error) {
        console.error('Error processing leave request:', error);
        res.status(500).send('Failed to process leave request.');
    }
});





app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}\n\n\thttp://localhost:${PORT}/\n`);
});
