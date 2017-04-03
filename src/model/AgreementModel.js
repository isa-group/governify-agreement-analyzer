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
const Ajv = require("ajv");
const ajv = new Ajv({ unknownFormats: ["int32", "int64", "float", "double", "byte", "binary", "date", "date-time", "password"] });
const logger = require("../logger/logger");
class AgreementModel {
    constructor(agreement) {
        this.agreement = agreement;
    }
    validate() {
        var schema = require("../schemas/agreement.json");
        var isValidModel = ajv.validate(schema, this.agreement);
        if (!isValidModel) {
            this.validationErrors = ajv.errors;
        }
        return isValidModel;
    }
}
exports.default = AgreementModel;
