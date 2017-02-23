'use strict';

const Analyzer = require("../operators/Analyzer").default;
const request = require("request");

exports.analysisPOST = function (args, res, next) {
    /**
     * Perform an analysis operation over an agreement
     *
     * operationName String Call <i>'operationName'</i> operation defined in Analyzer
     * analysisRequest AnalysisRequest XXX
     * returns cspToolsReponse
     **/

    let fileUri = args.analysisRequest.value.fileUrl;

    request(fileUri, (error, response, agreement) => {

        var resp = {};

        try {

            new Analyzer(agreement).isConsistent((err, sol) => {

                if (error || err) {
                    resp['application/json'] = {
                        "Error": error || err
                    };
                } else if (!error && response.statusCode == 200) {
                    resp['application/json'] = {
                        "result": sol
                    };

                    if (Object.keys(resp).length > 0) {
                        res.setHeader('Content-Type', 'application/json');
                    } else {
                        res.end();
                    }
                }
                res.end(JSON.stringify(resp[Object.keys(resp)[0]] || {}, null, 2));
            });

        } catch (err) {
            resp['application/json'] = {
                "Error": err
            };
            res.end(JSON.stringify(resp[Object.keys(resp)[0]] || {}, null, 2));
        }

    });

};