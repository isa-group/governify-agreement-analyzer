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


export default class Expression {

    private _variables: Set<string>;

    constructor(private _expr: string) {
        this.loadVariables();
    }

    private loadVariables(): void {
        this._variables = new Set(this.expr.match(/(\b(?!true)(?!false)(?!xor)(?!not)(?!\d))\w+/ig));
    }

    get variables(): Set<string> {
        return this._variables;
    }

    get expr(): string {
        return this._expr;
    }

    set variables(variables: Set<string>) {
        this._variables = variables;
    }

    set expr(expr: string) {
        this._expr = expr;
    }

    getMockExpression(suffix: string, option?: { keepOriginal }): string {
        var expr: string = this.expr;
        var keepOriginalMetrics: string[] = option && "keepOriginal" in option ? option.keepOriginal : [];
        this.variables.forEach((v) => {
            if (keepOriginalMetrics.indexOf(v) === -1) {
                var re = new RegExp(v, "g");
                expr = expr.replace(re, v + suffix);
            }
        });
        return expr;
    }

    /**
     * Check if all variables used in expression are included as a defined variable.
     * @param declaredProperties 
     */
    validateVariables(definedVariable: string[]): boolean {
        return [...this.variables].reduce((_acc, v) => _acc && definedVariable.indexOf(v) !== -1, true);
    }

}