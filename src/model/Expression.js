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
class Expression {
    constructor(_expr) {
        this._expr = _expr;
        this.loadVariables();
    }
    loadVariables() {
        this._variables = new Set(this.expr.match(/(\b(?!true)(?!false)(?!xor)(?!not)(?!\d))\w+/ig));
    }
    get variables() {
        return this._variables;
    }
    get expr() {
        return this._expr;
    }
    set variables(variables) {
        this._variables = variables;
    }
    set expr(expr) {
        this._expr = expr;
    }
    getMockExpression(suffix) {
        var expr = this.expr;
        this.variables.forEach((v) => {
            var re = new RegExp(v, "g");
            expr = expr.replace(re, v + suffix);
        });
        return expr;
    }
}
exports.default = Expression;
