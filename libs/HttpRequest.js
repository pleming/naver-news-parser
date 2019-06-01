/* Require Module */
var request = require("request");
var iconv = require("iconv-lite");
var cheerio = require("cheerio");

var getExponRV = function (avg) {
    return (-1 * (1 / (1 / avg))) * Math.log(1 - Math.random());
};

/* Configuration */
var connect = function (url, options, callback) {
    options = options || {};

    var defaultOptions = {
        method: "GET",
        charset: "UTF-8",
        params: {},
        headers: {},
        requestDelay: 100,
        requestTimeout: 60000,
        exponInterval: true
    };

    var keys = Object.keys(defaultOptions);

    for (var i = 0; i < keys.length; i++)
        options[keys[i]] = (typeof options[keys[i]] === "undefined") ? defaultOptions[keys[i]] : options[keys[i]];

    var connectInfo = {
        url: url,
        method: options.method,
        encoding: "binary",
        timeout: options.requestTimeout,
        headers: options.headers
    };

    if (options.method == "GET")
        connectInfo.qs = options.params;
    else if (options.method == "POST")
        connectInfo.form = options.params;

    setTimeout(function () {
        request(connectInfo, function (error, response, html) {
            if (error) {
                console.log("HttpRequest.request() : " + error.code);
                console.log("Connection Information : ");
                console.log(connectInfo);
                callback(null, null, error);
                return;
            }

            if (response.statusCode != 200) {
                console.log("HttpRequest.request() : Response Status Code : " + response.statusCode);

                error = {
                    status: false,
                    contents: "HttpRequest.request() : Response Status Code is NOT 200"
                };

                callback(null, null, error);
                return;
            }

            if (!error && response.statusCode == 200) {
                html = iconv.decode(new Buffer(html, "binary"), options.charset);
                var $ = cheerio.load(html, {decodeEntities: false});
                callback($, html, error);
                return;
            }
        });
    }, (options.exponInterval ? getExponRV(options.requestDelay) : options.requestDelay));
};

var obj = {
    connect: connect
};

exports = module.exports = obj;