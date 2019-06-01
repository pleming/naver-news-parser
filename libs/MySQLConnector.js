var mysql = require("mysql");

var connect = function (__host, __user, __password, __database) {
    var conn = mysql.createConnection({
        host: __host,
        user: __user,
        password: __password,
        database: __database
    });

    conn.connect(function (err) {
        if (err) {
            console.log("---------------------------------");
            console.log("MySQL Database Connect Failed!");
            console.log("Host : " + __host);
            console.log("Database : " + __database);
            console.log("Error : ");
            console.log(err);
            console.log("---------------------------------");
        } else {
            console.log("---------------------------------");
            console.log("MySQL Database Connect Success!");
            console.log("Host : " + __host);
            console.log("Database : " + __database);
            console.log("---------------------------------");
        }
    });

    return conn;
};

var obj = {
    connect: connect
};

exports = module.exports = obj;