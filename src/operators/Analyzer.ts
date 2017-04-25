/*!
governify-agreement-analyzer 0.5.1, built on: 2017-04-25
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


import CSPBuilder from "../builder/csp/CSPBuilder";
import Translator from "../translator/Translator";
import AgreementModel from "../model/AgreementModel";
import AnalyzerConfiguration from "./AnalyzerConfiguration";
import AgreementCompensationCSPModelBuilder from "../builder/AgreementCompensationCSPModelBuilder";

const request = require("request");
const fs = require("fs");
const yaml = require("js-yaml");
const logger = require("../logger/logger");
const exception = require("../util/exceptions/IllegalArgumentException");
const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const Reasoner = CSPTools.Reasoner;
var Promise = require("bluebird");
const ERROR_INTERNAL_SERVER_MSG = "Error 500: Internal server error.";

interface AnalyzerInterface {
    isConsistent(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableCFC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableCFC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableCCC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableCSC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableGCC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableOGT(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
    isSatisfiableOBT(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void);
}

export default class Analyzer implements AnalyzerInterface {

    _agreementPromise: typeof Promise;
    agreement: Object;
    configuration: AnalyzerConfiguration;
    compensationBuilder: AgreementCompensationCSPModelBuilder;

    constructor(configuration: AnalyzerConfiguration, private notValidable?: boolean) {

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

        // Set configuration
        this.configuration = new AnalyzerConfiguration();
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

        // Set agreement
        this.agreement = configuration.agreement.content;
        this.loadAgreementPromise();
    }

    get agreementPromise(): Promise<any> {
        return this._agreementPromise;
    }

    loadAgreementPromise(): void {

        var _pthis = this;
        this._agreementPromise = new Promise((resolve, reject) => {

            if (!_pthis.agreement) {
                if (_pthis.configuration.agreement.file && _pthis.configuration.agreement.file !== "") {
                    // If is a local agreement
                    var filePath = _pthis.configuration.agreement.file.startsWith("./") ?
                        _pthis.configuration.agreement.file : "./" + _pthis.configuration.agreement.file;

                    // Read file content
                    fs.readFile(filePath, "utf8", function (error: any, data: any) {

                        if (error) {
                            throw new Error("Cannot find local agreement in: " + _pthis.configuration.agreement.url + "\n" + error);
                        } else {
                            let agreementObj: any = yaml.safeLoad(data);
                            if (!_pthis.notValidable) {
                                let agreement: AgreementModel = new AgreementModel(agreementObj);
                                let isValid: boolean = agreement.validate();
                                if (isValid) {
                                    _pthis.agreement = agreementObj;
                                    resolve(agreementObj);
                                } else {
                                    logger.error(filePath.split("/").slice(-1).pop() + " file: ");
                                    logger.error(agreement.validationErrors);
                                    reject(agreement.validationErrors);
                                }
                            } else {
                                resolve(agreementObj);
                            }
                        }

                    });

                } else if (_pthis.configuration.agreement.url && _pthis.configuration.agreement.url !== "") {
                    // If is a remote agreement
                    var url: string = _pthis.configuration.agreement.url;
                    request(url, function (error: any, response: any, data: any) {

                        if (error) {
                            throw new Error("Cannot find remote agreement in: " + url + "\n" + error);
                        } else {
                            let agreementObj: any = yaml.safeLoad(data);
                            if (!_pthis.notValidable) {
                                let agreement: AgreementModel = new AgreementModel(agreementObj);
                                let isValid: boolean = agreement.validate();
                                if (isValid) {
                                    _pthis.agreement = agreementObj;
                                    resolve(agreementObj);
                                } else {
                                    reject("Invalid agreement on " + url + ": " + agreement.validationErrors);
                                }
                            } else {
                                resolve(agreementObj);
                            }
                        }

                    });

                } else {
                    throw new Error("Missing parameter: file, url or content (agreement)");
                }

            } else {
                resolve(_pthis.agreement);
            }

        });

    }

    isSatisfiableConstraints(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let mznDocument: string = new AgreementCompensationCSPModelBuilder(agreement).buildConstraints();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(mznDocument, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });


    }

    isConsistent(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            // Translate agreement object to CSPModel
            var translator: Translator = new Translator(new CSPBuilder());
            var model: typeof CSPModel = translator.translate(agreement);
            model.goal = "satisfy";

            // Call Reasoner solver
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableCFC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildCFC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableVFC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildVFC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableCCC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildCCC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableCSC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildCSC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableGCC(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildGCC();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableOGT(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildOGT();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

    isSatisfiableOBT(callback: (error: any, stdout?: string, stderr?: string, isSatisfiable?: boolean) => void) {

        var _pthis = this;
        this.agreementPromise.then(function (agreement: any) {

            let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(agreement);
            let model: typeof CSPModel = builder.buildOBT();
            var reasoner = new Reasoner(_pthis.configuration.reasoner);
            reasoner.solve(model, callback);

        }, function (error: any) {
            callback(error);
        }).catch((err) => {
            logger.error(err);
            callback(ERROR_INTERNAL_SERVER_MSG);
        });

    }

}