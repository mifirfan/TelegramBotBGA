const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "10.2.222.229",
    user: "reporting",
    password: "R3p0rt!ngZ02!",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
