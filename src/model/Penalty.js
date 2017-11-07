"use strict";
/*!
governify-agreement-analyzer 0.6.5, built on: 2017-11-07
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
class Penalty {
    constructor(name, over, valueCondition, objective) {
        this.name = name;
        this.over = over;
        this.valueCondition = valueCondition;
        this.objective = objective;
    }
    toComparison(index) {
        let value = this.valueCondition[index].value.expr;
        return this.name + " == " + value;
    }
    toLessComparison() {
        return this.name + " == 0";
    }
    getCFC1() {
        return this.valueCondition.map((valueCondition, index) => {
            return "((" + this.toComparison(index) + ") /\\ (" + valueCondition.condition.expr + "))";
        }).join(" xor ");
    }
    getCFC2() {
        return "((" + this.toLessComparison() + ") /\\ not (" + this.valueCondition.map((valueCondition, index) => {
            return "(" + this.valueCondition[index].condition.expr + ")";
        }).join(" \\/ ") + "))";
    }
    validateProperties(declaredProperties) {
        return this.valueCondition.reduce((acc, vc) => {
            return acc && vc.value.validateVariables(declaredProperties) && vc.condition.validateVariables(declaredProperties);
        }, true);
    }
    static getCFC1(penalties) {
        return penalties.map((p) => {
            return p.getCFC1();
        }).join(" xor ");
    }
    static getCFC2(penalties) {
        return penalties.map((p) => {
            return p.getCFC2();
        }).join(" /\\ ");
    }
}
exports.default = Penalty;
