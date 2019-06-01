var naverNewsParser = require("./parser/naver_news_parser");
var mysql = require("./libs/MySQLConnector");

var conn = mysql.connect("127.0.0.1", "pleming", "password", "ml");

// naverNewsParser.collectMainCategory(conn, function () {
//     console.log("Parsing Complete!");
//     conn.destroy();
// });

// naverNewsParser.collectSubCategory(conn, function () {
//     console.log("Parsing Complete!");
//     conn.destroy();
// });

naverNewsParser.collectNewsArticle(conn, function () {
    console.log("Parsing Complete!");
    conn.destroy();
});
