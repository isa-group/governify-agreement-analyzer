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


import Definition from "./Definition";
import Expression from "./Expression";

export default class Penalty {

    private _name: string;

    constructor(public guarantee: string, public over: Definition, public value: number,
        public condition: Expression, public objective: Expression) { }

    toComparison(): string {
        return this.name + " == " + Math.abs(this.value);
    }

    toLessComparison(): string {
        return this.name + " == 0";
    }

    get name(): string {
        return "Penalty_" + this.guarantee + "_" + this.over.name;
    }

    getCFC(): string {
        return "((" + this.toComparison() + ") /\\ (" + this.condition.expr + ")) xor ((" +
            this.toLessComparison() + ") /\\ not (" + this.condition.expr + "))";
    }
}