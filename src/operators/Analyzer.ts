/*!
governify-agreement-analyzer 0.0.1, built on: 2017-03-03
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


import CSPBuilder from "../translator/builders/csp/CSPBuilder";
import Translator from "../translator/Translator";
import CSPModel from "../model/csp/CSPModel";
import AgreementModel from "../model/AgreementModel";

const request = require("request");
const fs = require("fs");
const yaml = require("js-yaml");
const config = require("../configurations/config");
const Reasoner = require("governify-csp-tools").Reasoner;
const logger = require("../logger/logger");
const exception = require("../util/exceptions/IllegalArgumentException");
var Promise = require("bluebird");

interface AnalyzerInterface {
    isConsistent(callback: (condition: Boolean) => void);
}

interface AgreementInput {
    url: string;
    file: string;
}

export default class Analyzer implements AnalyzerInterface {

    private _agreementPromise;
    agreement: Object;
    reasonerConfig: Object;

    constructor(private agreementInput: AgreementInput, reasonerConfig?: any) {
        this.agreementInput = agreementInput;
        this.reasonerConfig = reasonerConfig ? reasonerConfig : config.reasoner;
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

        if (!this._agreementPromise && !this.agreement) {

            this._agreementPromise = new Promise((resolve, reject) => {

                if (this.agreementInput.file && this.agreementInput.file !== "") {

                    // Get agreement from file path
                    let filePath = this.agreementInput.file.startsWith("./") ? this.agreementInput.file : "./" + this.agreementInput.file;
                    fs.readFile(filePath, "utf8", function (error: any, data: any) {
                        if (error) {
                            throw new Error("Cannot find local agreement in: " + this.agreementInput.url + "\n" + error);
                        } else {
                            resolve(yaml.safeLoad(data));
                        }
                    });

                } else if (this.agreementInput.url && this.agreementInput.url !== "") {

                    // Get agreement from url
                    request(this.agreementInput.url, function (error: any, response: any, data: any) {
                        if (error) {
                            throw new Error("Cannot find remote agreement in: " + this.agreementInput.url + "\n" + error);
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

    isConsistent(callback: (error: any, solution?: Boolean) => void) {

        this._loadAgreement((error: any) => {

            if (!error) {

                logger.info("Executing \"isConsistent\" analysis operation on Reasoner...");

                // Translate agreement object to CSPModel
                var translator: Translator = new Translator(new CSPBuilder());
                var model: CSPModel = translator.translate(this.agreement);
                model.setGoal("satisfy");

                // Call Reasoner solver
                var reasoner = new Reasoner(this.reasonerConfig);
                reasoner.solve(model, (err, sol) => {

                    if (err) {

                        logger.info("Reasoner returned an error:", err);
                        callback(err, sol);

                    } else {

                        let condition = (typeof sol === "string" && sol.indexOf("----------") !== -1) ||
                            (typeof sol === "object" && sol.status === "OK" && sol.message.indexOf("----------") !== -1);
                        logger.info("Reasoner result:", condition);
                        callback(err, condition);

                    }

                });

            } else {
                callback(error);
            }

        });
    }
}