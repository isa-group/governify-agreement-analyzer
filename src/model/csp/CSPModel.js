/*!
governify-agreement-analyzer 0.0.0, built on: 2017-02-23
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
var CSPModel = (function () {
    function CSPModel() {
        this.parameters = [];
        this.variables = [];
        this.constraints = [];
        this.goals = [];
    }
    CSPModel.prototype.addParameter = function (param) {
        if (!this.existParam(param)) {
            this.parameters.push(param);
        }
    };
    CSPModel.prototype.existParam = function (param) {
        var exists = false;
        this.parameters.forEach(function (p) {
            if (!exists && p.id === param.id && p.type === param.type && p.value === param.value) {
                exists = true;
            }
        });
        return exists;
    };
    CSPModel.prototype.setGoal = function (goal) {
        this.goals = [goal];
    };
    return CSPModel;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CSPModel;
