const mysql = require('mysql2');
require('dotenv').config();

// Create the connection to database
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Connect and catch any errors
db.connect((err) => {
    if (err) {
        console.error('Database connection failed! Error:', err.message);
        return;
    }
    console.log('Connected to MySQL database (wellsmartbook_db) successfully!');
});

module.exports = db;