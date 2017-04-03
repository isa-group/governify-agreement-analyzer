/*!
governify-agreement-analyzer 0.3.0, built on: 2017-04-03
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
const CSPBuilder_1 = require("../builder/csp/CSPBuilder");
const Translator_1 = require("../translator/Translator");
const AgreementModel_1 = require("../model/AgreementModel");
const AnalyzerConfiguration_1 = require("./AnalyzerConfiguration");
const AgreementCompensationCSPModelBuilder_1 = require("../builder/AgreementCompensationCSPModelBuilder");
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
    constructor(configuration, notValidable) {
        this.notValidable = notValidable;
        if (!configuration) {
            throw new Error("Missing parameter: configuration (Object)");
        }
        if (!configuration.agreement) {
            throw new Error("Missing parameter: agreement (Object)");
        }
        if (!configuration.reasoner) {
            throw new Error("Missing parameter: reasoner (Object)");
        }
        if (!configuration.agreement.file && !configuration.agreement.url && !configuration.agreement.content) {
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
        this.configuration.agreement.content = configuration.agreement.content;
        this.configuration.reasoner.type = configuration.reasoner.type;
        this.configuration.reasoner.folder = configuration.reasoner.folder;
        if (configuration.reasoner.api) {
            this.configuration.reasoner.api = configuration.reasoner.api;
            this.configuration.reasoner.api.version = configuration.reasoner.api.version;
            this.configuration.reasoner.api.server = configuration.reasoner.api.server;
            this.configuration.reasoner.api.operationPath = configuration.reasoner.api.operationPath;
        }
        this.agreement = configuration.agreement.content;
        this.loadAgreementPromise();
    }
    get agreementPromise() {
        return this._agreementPromise;
    }
    loadAgreementPromise() {
        var _pthis = this;
        this._agreementPromise = new Promise((resolve, reject) => {
            if (!_pthis.agreement) {
                if (_pthis.configuration.agreement.file && _pthis.configuration.agreement.file !== "") {
                    var filePath = _pthis.configuration.agreement.file.startsWith("./") ?
                        _pthis.configuration.agreement.file : "./" + _pthis.configuration.agreement.file;
                    fs.readFile(filePath, "utf8", function (error, data) {
                        if (error) {
                            throw new Error("Cannot find local agreement in: " + _pthis.configuration.agreement.url + "\n" + error);
                        }
                        else {
                            let agreementObj = yaml.safeLoad(data);
                            if (!_pthis.notValidable) {
                                let agreement = new AgreementModel_1.default(agreementObj);
                                let isValid = agreement.validate();
                                if (isValid) {
                                    _pthis.agreement = agreementObj;
                                    resolve(agreementObj);
                                }
                                else {
                                    logger.error(filePath.split("/").slice(-1).pop() + " file: ");
                                    logger.error(agreement.validationErrors);
                                    reject(agreement.validationErrors);
                                }
                            }
                            else {
                                resolve(agreementObj);
                            }
                        }
                    });
                }
                else if (_pthis.configuration.agreement.url && _pthis.configuration.agreement.url !== "") {
                    var url = _pthis.configuration.agreement.url;
                    request(url, function (error, response, data) {
                        if (error) {
                            throw new Error("Cannot find remote agreement in: " + url + "\n" + error);
                        }
                        else {
                            let agreementObj = yaml.safeLoad(data);
                            if (!_pthis.notValidable) {
                                let agreement = new AgreementModel_1.default(agreementObj);
                                let isValid = agreement.validate();
                                if (isValid) {
                                    _pthis.agreement = agreementObj;
                                    resolve(agreementObj);
                                }
                                else {
                                    reject("Invalid agreement on " + url + ": " + agreement.validationErrors);
                                }
                            }
                            else {
                                resolve(agreementObj);
                            }
                        }
                    });
                }
                else {
                    throw new Error("Missing parameter: file, url or content (agreement)");
                }
            }
            else {
                resolve(_pthis.agreement);
            }
        });
    }
    isSatisfiableConstraints(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let mznDocument = new AgreementCompensationCSPModelBuilder_1.default(agreement).buildConstraints();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(mznDocument, callback);
        }, function (error) {
            callback(error);
        });
    }
    isConsistent(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            var translator = new Translator_1.default(new CSPBuilder_1.default());
            var model = translator.translate(agreement);
            model.goal = "satisfy";
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableCFC(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildCFC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableVFC(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildVFC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableCCC(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildCCC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableCSC(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildCSC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableGCC(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildGCC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableOGT(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildOGT();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
    isSatisfiableOBT(callback) {
        var _pthis = this;
        this.agreementPromise.then(function (agreement) {
            let builder = new AgreementCompensationCSPModelBuilder_1.default(agreement);
            let model = builder.buildOBT();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);
        }, function (error) {
            callback(error);
        });
    }
}
exports.default = Analyzer;
