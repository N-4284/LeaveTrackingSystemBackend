// server.js
const express = require('express');
require('dotenv').config();
const { sql, pool, poolConnect, GetMethod } = require('./db');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;


const app = express();
app.use(cors());
app.use(express.json());
const PORT = parseInt(process.env.PORT, 10);


const authMiddleware = async(req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');  

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, secretKey);

        const query = `SELECT userID, roleName FROM Users JOIN Roles ON Users.roleID = Roles.roleID WHERE userID = @userID`;

        const result = await pool.request()
            .input('userID', sql.Int, decoded.sub)
            .query(query);

        const user= result.recordset[0];
        if (!decoded.sub || !decoded.role) {
          
            return res.status(400).json({ message: decoded });
        }

        if(user.userID !== decoded.sub || user.roleName !== decoded.role) {
            return res.status(403).json({ message: 'Access denied. Invalid token.' });
        }

        req.user = { userID: decoded.sub, role :decoded.role };  
        next();
    } catch (err) {
        console.error('JWT verification failed:', err.message);
        res.status(401).json({ message: 'Invalid token' });
    }
};


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


app.get('/Attendance', authMiddleware, async (req,res) =>{
    try{
        const result = await GetMethod('SELECT a.attendanceID, a.userID, a.date, lt.leaveTypeName AS status FROM Attendance AS a JOIN LeaveTypes lt ON a.attendanceStatusID = lt.leaveTypeID ORDER BY a.date DESC');
        res.json(result.recordset);
    }catch (err){
        console.error('Error fetching Attendance:', err);
        res.status(500).send('Failed to get Attendance');
    }
    
});

app.post('/Attendance', authMiddleware, async (req, res) => {
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
        const query = `SELECT userID, roleName FROM Users JOIN Roles ON Users.roleID = Roles.roleID WHERE email = @email AND hashedPassword = @hashedPassword`;

        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('hashedPassword', sql.VarChar, password)
            .query(query);

        const user= result.recordset[0];

        if (result.recordset.length > 0) {
            const token = jwt.sign({ sub: user.userID , role:user.roleName}, secretKey, { expiresIn: '1h' });
            
            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    token: token
                }

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


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}\n\n\thttp://localhost:${PORT}/\n`);
});
