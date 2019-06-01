var http = require("../libs/HttpRequest");
var cheerio = require("cheerio");

var requestDelay = 1000;

var collectMainCategory = function (conn, callback) {
    var insertMainCategory = function (conn, mainCategoryInfo, idx, callback) {
        if (mainCategoryInfo.length == idx) {
            callback();
            return;
        }

        conn.query("INSERT INTO ml.main_category SET ?", mainCategoryInfo[idx], function () {
            insertMainCategory(conn, mainCategoryInfo, idx + 1, callback);
        });
    };

    http.connect("https://news.naver.com/", { charset: "EUC-KR", requestDelay: requestDelay, exponInterval: true }, function ($, html, error) {
        var mainCategoryInfo = [];

        $("div#lnb > ul > li > a").each(function (idx, elem) {
            if (idx < 2)
                return true;

            if (idx > 7)
                return false;

            var mainCategory = {
                id: /sid1\=\d+/gim.exec($(elem).attr("href")),
                name: $(elem).children("span.tx").text()
            };

            if (mainCategory.id == null || mainCategory.id.length != 1)
                return true;

            mainCategory.id = mainCategory.id[0].replace("sid1=", "");

            mainCategoryInfo.push(mainCategory);
        });

        insertMainCategory(conn, mainCategoryInfo, 0, function () {
            callback();
        });
    });
};

var collectSubCategory = function (conn, callback) {
    var parseSubCategory = function (conn, mainCategoryInfo, subCategoryInfo, idx, callback) {
        if (mainCategoryInfo.length == idx) {
            callback(subCategoryInfo);
            return;
        }

        http.connect("https://news.naver.com/main/list.nhn?sid1=" + mainCategoryInfo[idx].id, { charset: "EUC-KR", requestDelay: requestDelay, exponInterval: true }, function ($, html, error) {
            var lastIdx = $("div#snb > ul > li").length - 1;

            $("div#snb > ul > li").each(function (i, elem) {
                if (i >= lastIdx)
                    return false;

                var link = $(elem).children("a");

                var subCategory = {
                    "sub_category_id": /sid2\=\d+/gim.exec(link.attr("href")),
                    "main_category_id": mainCategoryInfo[idx].id,
                    "name": link.text().replace(/\s/gim, "")
                };

                if (subCategory["sub_category_id"] == null || subCategory["sub_category_id"].length != 1)
                    return true;

                subCategory["sub_category_id"] = subCategory["sub_category_id"][0].replace("sid2=", "");

                subCategoryInfo.push(subCategory);
            });

            parseSubCategory(conn, mainCategoryInfo, subCategoryInfo, idx + 1, callback);
        });
    };

    var insertSubCategory = function (conn, subCategoryInfo, idx, callback) {
        if (subCategoryInfo.length == idx) {
            callback();
            return;
        }

        conn.query("INSERT INTO ml.sub_category SET ?", subCategoryInfo[idx], function () {
            insertSubCategory(conn, subCategoryInfo, idx + 1, callback);
        });
    };

    conn.query("SELECT * FROM ml.main_category", function (err, res) {
        parseSubCategory(conn, res, [], 0, function (subCategoryInfo) {
            insertSubCategory(conn, subCategoryInfo, 0, function () {
                callback();
            });
        });
    });
};

var collectNewsArticle = function (conn, callback) {
    var startDate = new Date(2019, 5, 20, 0, 0, 0);
    var lastDate = new Date(2019, 5, 31, 0, 0, 0);

    var parseDatetime = function (datetimeStrElem) {
        var datetimeStr = null;

        if (datetimeStrElem.length >= 2)
            datetimeStr = cheerio(datetimeStrElem[0]).text();
        else
            datetimeStr = datetimeStrElem.text();

        var _date = new Date(/[0-9]{4}\.[0-9]{2}\.[0-9]{2}/gim.exec(datetimeStr));
        var hour = parseInt(/[0-9]{1,}\:[0-9]{1,}/gim.exec(datetimeStr)[0].split(":")[0]);
        var minute = parseInt(/[0-9]{1,}\:[0-9]{1,}/gim.exec(datetimeStr)[0].split(":")[1]);
        var ampm = /오전|오후/gim.exec(datetimeStr)[0];

        if (ampm === "오후" && hour <= 12)
            hour += 12;

        _date.setHours(hour, minute);

        return _date;
    };

    var parseNewsArticle = function (conn, category, newsArticleUrlInfo, idx, callback) {
        if (newsArticleUrlInfo.length == idx) {
            callback();
            return;
        }

        http.connect(newsArticleUrlInfo[idx], {charset: "EUC-KR", requestDelay: requestDelay, exponInterval: true}, function ($, html, error) {
            console.log(newsArticleUrlInfo[idx]);

            var newsArticle = {
                main_category_id: /sid1\=\d+/gim.exec(newsArticleUrlInfo[idx])[0].replace("sid1=", ""),
                sub_category_id:  /sid2\=\d+/gim.exec(newsArticleUrlInfo[idx])[0].replace("sid2=", ""),
                datetime: parseDatetime($("div.sponsor > span.t11")),
                title: $("h3#articleTitle").text().replace(/(^\s*)|(\s*$)/gim, ""),
                contents: $("div#articleBodyContents").text().replace(/(^\s*)|(\s*$)/gim, "").replace(/\s+/gim, " ")
            };

            conn.query("INSERT INTO ml.news_article SET ?", newsArticle, function () {
                parseNewsArticle(conn, category, newsArticleUrlInfo, idx + 1, callback);
            });
        });
    };

    var pageLoop = function (conn, _date, categoryInfo, categoryIdx, pageIdx, callback) {
        var m = _date.getMonth().toString().length == 1 ? "0" + _date.getMonth().toString() : _date.getMonth().toString();
        var d = _date.getDate().toString().length == 1 ? "0" + _date.getDate().toString() : _date.getDate().toString();

        http.connect("https://news.naver.com/main/list.nhn?mode=LS2D&mid=shm&" +
            "sid1=" + categoryInfo[categoryIdx].mainCategoryId + "&" +
            "sid2=" + categoryInfo[categoryIdx].subCategoryId + "&" +
            "date=" + _date.getFullYear().toString() + m + d + "&" +
            "page=" + pageIdx, {
                    charset: "EUC-KR",
                    requestDelay: requestDelay,
                    exponInterval: true
                }, function ($, html, error) {

            if ($("div.paging > strong").text() != pageIdx.toString()) {
                callback();
                return;
            }

            var newsArticleUrlInfo = [];

            $("div.newsflash_body > ul > li > dl > dt").each(function(idx, elem) {
                if ($(elem).hasClass("photo"))
                    return true;

                newsArticleUrlInfo.push($(elem).children("a").attr("href"));
            });

            parseNewsArticle(conn, categoryInfo[categoryIdx], newsArticleUrlInfo, 0, function () {
                pageLoop(conn, _date, categoryInfo, categoryIdx, pageIdx + 1, callback);
            });
        });
    };

    var categoryLoop = function (conn, _date, categoryInfo, idx, callback) {
        if(categoryInfo.length == idx) {
            callback();
            return;
        }

        var m = _date.getMonth().toString().length == 1 ? "0" + _date.getMonth().toString() : _date.getMonth().toString();
        var d = _date.getDate().toString().length == 1 ? "0" + _date.getDate().toString() : _date.getDate().toString();

        console.log(categoryInfo[idx].mainCategoryName + " - " + categoryInfo[idx].subCategoryName + "(" + _date.getFullYear().toString() + "-" + m + "-" + d + ")");

        pageLoop(conn, _date, categoryInfo, idx, 1, function() {
           categoryLoop(conn, _date, categoryInfo, idx + 1, callback);
        });
    };

    var dateLoop = function (conn, _startDate, categoryInfo, callback) {
        if (lastDate.getTime() == _startDate.getTime()) {
            callback();
            return;
        }

        categoryLoop(conn, _startDate, categoryInfo, 0,function() {
            _startDate.setDate(_startDate.getDate() + 1);

            dateLoop(conn, _startDate, categoryInfo, callback);
        });
    };

    conn.query("SELECT " +
                    "MC.id AS mainCategoryId, " +
                    "SC.sub_category_id AS subCategoryId, " +
                    "MC.name AS mainCategoryName, " +
                    "SC.name AS subCategoryName " +
                "FROM ml.sub_category AS SC " +
                "INNER JOIN ml.main_category AS MC ON MC.id = SC.main_category_id", function (err, res) {
        dateLoop(conn, startDate, res, function() {
        });
    });
};

var obj = {
    collectMainCategory: collectMainCategory,
    collectSubCategory: collectSubCategory,
    collectNewsArticle: collectNewsArticle
};

exports = module.exports = obj;
