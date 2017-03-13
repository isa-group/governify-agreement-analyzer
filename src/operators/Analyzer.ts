/*!
governify-agreement-analyzer 0.1.1, built on: 2017-03-13
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
const CSPTools = require("E:\\Documents\\Coding\\CSP\\governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const Reasoner = CSPTools.Reasoner;
var Promise = require("bluebird");

interface AnalyzerInterface {
    isConsistent(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableCFC(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableCFC(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableCCC(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableCSC(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableGCC(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableOGT(callback: (error: any, solution?: Boolean, stdout?: string) => void);
    isSatisfiableOBT(callback: (error: any, solution?: Boolean, stdout?: string) => void);
}

export default class Analyzer implements AnalyzerInterface {

    _agreementPromise: typeof Promise;
    agreement: Object;
    configuration: AnalyzerConfiguration;
    compensationBuilder: AgreementCompensationCSPModelBuilder;

    constructor(configuration: AnalyzerConfiguration) {

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

        this.configuration = new AnalyzerConfiguration();
        this.configuration.agreement.file = configuration.agreement.file;
        this.configuration.agreement.url = configuration.agreement.url;
        this.configuration.agreement.content = configuration.agreement.content;
        this.agreement = configuration.agreement.content;
        this.configuration.reasoner.type = configuration.reasoner.type;
        this.configuration.reasoner.folder = configuration.reasoner.folder;
        if (configuration.reasoner.api) {
            this.configuration.reasoner.api = configuration.reasoner.api;
            this.configuration.reasoner.api.version = configuration.reasoner.api.version;
            this.configuration.reasoner.api.server = configuration.reasoner.api.server;
            this.configuration.reasoner.api.operationPath = configuration.reasoner.api.operationPath;
        }

    }

    /**
     * Private method to asynchronous load an agreement in a instance by using Promise.
     * @param callback
     */
    private _loadAgreement(callback: (error?: any) => void): void {

        if (!this.agreement) {

            this._getAgreementPromise().then((agreementObj: any) => {

                // Validate and store agreement
                let agreement: AgreementModel = new AgreementModel(agreementObj);
                let isValid: boolean = agreement.validate();
                if (isValid) {
                    this.agreement = agreementObj;
                    callback();
                } else {
                    logger.info("Invalid agreement:", agreement.validationErrors);
                    callback(agreement.validationErrors);
                }

            });

        } else {
            callback();
        }
    }

    private _getAgreementPromise(): Promise<Object> {

        var _prevThis = this;

        if (!_prevThis._agreementPromise && !_prevThis.agreement) {

            _prevThis._agreementPromise = new Promise((resolve, reject) => {

                if (_prevThis.configuration.agreement.file && _prevThis.configuration.agreement.file !== "") {

                    // Get agreement from file path
                    let filePath = _prevThis.configuration.agreement.file.startsWith("./") ?
                        _prevThis.configuration.agreement.file : "./" + _prevThis.configuration.agreement.file;

                    fs.readFile(filePath, "utf8", function (error: any, data: any) {
                        if (error) {
                            throw new Error("Cannot find local agreement in: " + _prevThis.configuration.agreement.url + "\n" + error);
                        } else {
                            resolve(yaml.safeLoad(data));
                        }
                    });

                } else if (_prevThis.configuration.agreement.url && _prevThis.configuration.agreement.url !== "") {

                    // Get agreement from url
                    request(_prevThis.configuration.agreement.url, function (error: any, response: any, data: any) {
                        if (error) {
                            throw new Error("Cannot find remote agreement in: " + _prevThis.configuration.agreement.url + "\n" + error);
                        } else {
                            resolve(yaml.safeLoad(data));
                        }
                    });

                } else {

                    throw new Error("Missing parameter: file or url (agreement)");

                }

            });

        }

        return this._agreementPromise;

    }

    isSatisfiableConstraints(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        var _pthis = this;

        this._loadAgreement((error: any) => {

            if (!error) {

                let mznDocument: string = new AgreementCompensationCSPModelBuilder(_pthis.agreement).buildConstraints();
                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(mznDocument, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });
    }

    isConsistent(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isConsistent\" analysis operation on Reasoner...");

                // Translate agreement object to CSPModel
                var translator: Translator = new Translator(new CSPBuilder());
                var model: typeof CSPModel = translator.translate(this.agreement);
                model.goal = "satisfy";

                // Call Reasoner solver
                var reasoner = new Reasoner(this.configuration.reasoner);
                reasoner.solve(model, (err, sol) => {

                    if (err) {

                        logger.info("Reasoner returned an error:", err);
                        callback(err, sol, sol);

                    } else {

                        let condition = (typeof sol === "string" && sol.indexOf("----------") !== -1) ||
                            (typeof sol === "object" && sol.status === "OK" && sol.message.indexOf("----------") !== -1);
                        logger.info("Reasoner result:", condition);
                        callback(err, condition, sol);

                    }

                });

            } else {
                callback(error);
            }

        });
    }

    isSatisfiableCFC(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isSatisfiableCFC\" analysis operation on Reasoner...");

                let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
                let model: typeof CSPModel = builder.buildCFC();

                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });

    }

    isSatisfiableCCC(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isSatisfiableCCC\" analysis operation on Reasoner...");

                let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
                let model: typeof CSPModel = builder.buildCCC();

                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });

    }

    isSatisfiableCSC(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isSatisfiableCSC\" analysis operation on Reasoner...");

                let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
                let model: typeof CSPModel = builder.buildCSC();

                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });

    }

    isSatisfiableGCC(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isSatisfiableGCC\" analysis operation on Reasoner...");

                let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
                let model: typeof CSPModel = builder.buildGCC();

                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });

    }

    isSatisfiableOGT(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isSatisfiableOGT\" analysis operation on Reasoner...");

                let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
                let model: typeof CSPModel = builder.buildOGT();

                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });

    }

    isSatisfiableOBT(callback: (error: any, solution?: Boolean, stdout?: string) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isSatisfiableOBT\" analysis operation on Reasoner...");

                let builder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
                let model: typeof CSPModel = builder.buildOBT();

                var reasoner = new Reasoner(this.configuration.reasoner);

                reasoner.solve(model, (err, sol) => {
                    if (err) {
                        logger.info("Reasoner returned an error:", err);
                    } else {
                        logger.info("Reasoner result:", sol);
                    }
                    callback(err, sol);
                });

            } else {
                callback(error);
            }

        });

    }

}