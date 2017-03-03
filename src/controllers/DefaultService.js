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

    var resp = {};

    new Analyzer(args.analysisRequest.value).isConsistent((error, sol) => {

        res.end(JSON.stringify({
            "result": error || sol
        }), null, 2);
        
    });

};