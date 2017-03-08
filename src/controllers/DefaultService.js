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

    var config = args.analysisRequest.value;
    var analyzer = new Analyzer(config);
    var resp = {};

    analyzer.isConsistent(function (err, sol) {
        res.end(JSON.stringify({
            "result": err || sol
        }), null, 2);
    });

};