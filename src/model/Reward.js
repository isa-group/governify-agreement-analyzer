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
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Reward {
    constructor(guarantee, over, value, condition, objective) {
        this.guarantee = guarantee;
        this.over = over;
        this.value = value;
        this.condition = condition;
        this.objective = objective;
    }
    toComparison() {
        return this.name + " == " + Math.abs(this.value);
    }
    toLessComparison() {
        return this.name + " == 0";
    }
    get name() {
        return "Reward_" + this.guarantee + "_" + this.over.name;
    }
    getCFC() {
        return "((" + this.toComparison() + ") /\\ (" + this.condition.expr + ")) xor ((" +
            this.toLessComparison() + ") /\\ not (" + this.condition.expr + "))";
    }
}
exports.default = Reward;
