"use strict";
/*!
governify-agreement-analyzer 0.6.1, built on: 2017-10-13
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
Object.defineProperty(exports, "__esModule", { value: true });
const CSPTools = require("governify-csp-tools");
const logger = require("../logger/logger");
const CSPRange = CSPTools.CSPRange;
class Domain {
    constructor(minOrType, max) {
        if (!isNaN(Number(max))) {
            this._min = minOrType;
            this._max = max;
        }
        else {
            this.type = minOrType;
        }
    }
    getRangeOrType() {
        var rangeOrType;
        if (this.type) {
            rangeOrType = this.type;
        }
        else {
            rangeOrType = new CSPRange(this.min, this.max);
        }
        return rangeOrType;
    }
    get min() {
        if (isNaN(Number(this._min)) && !this._min) {
            let errorMsg = "Unable to get min value from Domain";
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        else {
            return this._min;
        }
    }
    get max() {
        if (isNaN(Number(this._max)) && !this._max) {
            let errorMsg = "Unable to get max value from Domain";
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        else {
            return this._max;
        }
    }
}
exports.default = Domain;
