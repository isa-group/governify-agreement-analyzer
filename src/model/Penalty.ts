/*!
governify-agreement-analyzer 0.6.2, built on: 2017-10-13
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


import Definition from "./Definition";
import Expression from "./Expression";

export default class Penalty {

    private _name: string;

    constructor(public name: string, public over: Definition,
        public valueCondition: ValueCondition[], public objective: Expression) { }

    toComparison(index: number): string {
        let value = this.valueCondition[index].value.expr;
        let m = value.match(/^[\(\s]*\-(.*)$/);
        return this.name + " == " + (m && m.length === 2 ? m[1] : value);
    }

    toLessComparison(): string {
        return this.name + " == 0";
    }

    getCFC1(): string {
        return this.valueCondition.map((valueCondition: ValueCondition, index) => {
            return "((" + this.toComparison(index) + ") /\\ (" + valueCondition.condition.expr + "))";
        }).join(" xor ");
    }

    getCFC2(): string {
        return "((" + this.toLessComparison() + ") /\\ not (" + this.valueCondition.map((valueCondition: ValueCondition, index) => {
            return "(" + this.valueCondition[index].condition.expr + ")";
        }).join(" \\/ ") + "))";
    }

    /**
     * Check if all properties used in penalty condition are declared
     * @param declaredProperties 
     */
    validateProperties(declaredProperties: string[]): boolean {
        return this.valueCondition.reduce((acc, vc) => {
            return acc && vc.value.validateVariables(declaredProperties) && vc.condition.validateVariables(declaredProperties);
        }, true);
    }

    static getCFC1(penalties: Penalty[]): string {
        return penalties.map((p) => {
            return p.getCFC1();
        }).join(" xor ");
    }

    static getCFC2(penalties: Penalty[]): string {
        return penalties.map((p) => {
            return p.getCFC2();
        }).join(" /\\ ");
    }
}

interface ValueCondition {
    value?: Expression;
    condition?: Expression;
}