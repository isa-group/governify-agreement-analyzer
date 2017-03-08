/*!
governify-agreement-analyzer 0.1.0, built on: 2017-03-08
Copyright (C) 2017 ISA group
http://www.isa.us.es/
https://github.com/isa-group/governify-agreement-analyzer

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CSPBuilder_1 = require("../translator/builders/csp/CSPBuilder");
const Translator_1 = require("../translator/Translator");
const AgreementModel_1 = require("../model/AgreementModel");
const AnalyzerConfiguration_1 = require("./AnalyzerConfiguration");
const request = require("request");
const fs = require("fs");
const yaml = require("js-yaml");
const logger = require("../logger/logger");
const exception = require("../util/exceptions/IllegalArgumentException");
const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const Reasoner = CSPTools.Reasoner;
var Promise = require("bluebird");
class Analyzer {
    constructor(configuration) {
        if (!configuration) {
            throw new Error("Missing parameter: configuration (Object)");
        }
        if (!configuration.agreement) {
            throw new Error("Missing parameter: agreement (Object)");
        }
        if (!configuration.reasoner) {
            throw new Error("Missing parameter: reasoner (Object)");
        }
        if (!configuration.agreement.file && !configuration.agreement.url) {
            throw new Error("Missing parameter: agreement.file or agreement.url (String)");
        }
        if (!configuration.reasoner.type) {
            throw new Error("Missing parameter: reasoner.type (String)");
        }
        if (!configuration.reasoner.folder) {
            throw new Error("Missing parameter: reasoner.folder (String)");
        }
        this.configuration = new AnalyzerConfiguration_1.default();
        this.configuration.agreement.file = configuration.agreement.file;
        this.configuration.agreement.url = configuration.agreement.url;
        this.configuration.reasoner.type = configuration.reasoner.type;
        this.configuration.reasoner.folder = configuration.reasoner.folder;
        if (configuration.reasoner.api) {
            this.configuration.reasoner.api = configuration.reasoner.api;
            this.configuration.reasoner.api.version = configuration.reasoner.api.version;
            this.configuration.reasoner.api.server = configuration.reasoner.api.server;
            this.configuration.reasoner.api.operationPath = configuration.reasoner.api.operationPath;
        }
    }
    _loadAgreement(callback) {
        if (!this.agreement) {
            this._getAgreementPromise().then((agreementObj) => {
                let agreement = new AgreementModel_1.default(agreementObj);
                let isValid = agreement.validate();
                if (isValid) {
                    this.agreement = agreementObj;
                    callback();
                }
                else {
                    logger.info("Invalid agreement:", agreement.validationErrors);
                    callback(agreement.validationErrors);
                }
            });
        }
        else {
            callback();
        }
    }
    _getAgreementPromise() {
        var _prevThis = this;
        if (!_prevThis._agreementPromise && !_prevThis.agreement) {
            _prevThis._agreementPromise = new Promise((resolve, reject) => {
                if (_prevThis.configuration.agreement.file && _prevThis.configuration.agreement.file !== "") {
                    let filePath = _prevThis.configuration.agreement.file.startsWith("./") ?
                        _prevThis.configuration.agreement.file : "./" + _prevThis.configuration.agreement.file;
                    fs.readFile(filePath, "utf8", function (error, data) {
                        if (error) {
                            throw new Error("Cannot find local agreement in: " + _prevThis.configuration.agreement.url + "\n" + error);
                        }
                        else {
                            resolve(yaml.safeLoad(data));
                        }
                    });
                }
                else if (_prevThis.configuration.agreement.url && _prevThis.configuration.agreement.url !== "") {
                    request(_prevThis.configuration.agreement.url, function (error, response, data) {
                        if (error) {
                            throw new Error("Cannot find remote agreement in: " + _prevThis.configuration.agreement.url + "\n" + error);
                        }
                        else {
                            resolve(yaml.safeLoad(data));
                        }
                    });
                }
                else {
                    throw new Error("Missing parameter: file or url (agreement)");
                }
            });
        }
        return this._agreementPromise;
    }
    isConsistent(callback) {
        this._loadAgreement((error) => {
            if (!error) {
                logger.info("Executing \"isConsistent\" analysis operation on Reasoner...");
                var translator = new Translator_1.default(new CSPBuilder_1.default());
                var model = translator.translate(this.agreement);
                model.goal = "satisfy";
                var reasoner = new Reasoner(this.configuration.reasoner);
                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                        callback(err, sol, sol);
                    }
                    else {
                        let condition = (typeof sol === "string" && sol.indexOf("----------") !== -1) ||
                            (typeof sol === "object" && sol.status === "OK" && sol.message.indexOf("----------") !== -1);
                        logger.info("Reasoner result:", condition);
                        callback(err, condition, sol);
                    }
                });
            }
            else {
                callback(error);
            }
        });
    }
}
exports.default = Analyzer;
