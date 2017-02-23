/*!
governify-agreement-analyzer 0.0.1, built on: 2017-02-22
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

const yaml = require("js-yaml");
const config = require("../configurations/config");
const Reasoner = require("../../../governify-csp-tools").Reasoner;
const logger = require("../logger/logger");
const exception = require("../util/exceptions/IllegalArgumentException");

interface AnalyzerInterface {
    isConsistent(callback: (condition: Boolean) => void, reasonerConfig?: any);
}

export default class Analyzer implements AnalyzerInterface {

    agreement: Object;

    constructor(agreement: Object) {
        let _model = yaml.safeLoad(agreement);
        let isValid: boolean = new AgreementModel(_model).validate();
        if (isValid) {
            this.agreement = _model;
        } else {
            return null;
        }
    }

    isConsistent(callback: (error: any, condition: Boolean) => void, reasonerConfig?: any) {
        logger.info("Executing 'isConsistent' analysis operation...");

        var translator: Translator = new Translator(new CSPBuilder());
        var model: CSPModel = translator.translate(this.agreement);
        model.setGoal("satisfy");

        var reasoner = new Reasoner(reasonerConfig ? reasonerConfig : config.reasoner);
        reasoner.solve(model, (error, sol) => {
            if (error) {
                logger.info("'isConsistent' error:", error);
                callback(error, sol);
            } else {
                let condition = (typeof sol === "string" && sol.indexOf("----------") !== -1) ||
                    (typeof sol === "object" && sol.status === "OK" && sol.message.indexOf("----------") !== -1);
                logger.info("'isConsistent' result:", condition);
                callback(error, condition);
            }
        });
    }

}