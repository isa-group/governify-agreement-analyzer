/*!
governify-agreement-analyzer 0.0.1, built on: 2017-03-03
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
const CSPBuilder_1 = require("../translator/builders/csp/CSPBuilder");
const CSPVar_1 = require("../model/csp/CSPVar");
const CSPConstraint_1 = require("../model/csp/CSPConstraint");
class Translator {
    constructor(builder) {
        this.builder = builder;
    }
    translate(agModel) {
        var parameters = [];
        var variables = [];
        var constraints = [];
        var goals = [];
        var definitions = agModel["context"]["definitions"]["schemas"];
        Object.keys(definitions).forEach(function (name) {
            variables.push(new CSPVar_1.default(name, definitions[name]["type"]));
        });
        var metrics = agModel["terms"]["metrics"];
        Object.keys(metrics).forEach(function (name) {
            variables.push(new CSPVar_1.default(name, metrics[name]["schema"]["type"]));
        });
        var guarantees = agModel["terms"]["guarantees"];
        guarantees.forEach(function (guarantee) {
            guarantee.of.forEach(function (of, index) {
                var constraint;
                var constId = guarantee.id + "_" + index;
                if (of.precondition && of.precondition !== "") {
                    constraint = new CSPConstraint_1.default(constId, "(" + of.precondition + ") -> (" + of.objective + ")");
                }
                else if (of.objective && of.objective !== "") {
                    constraint = new CSPConstraint_1.default(constId, of.objective);
                }
                constraints.push(constraint);
            });
        });
        var builder = new CSPBuilder_1.default();
        builder.model.variables = variables;
        builder.model.constraints = constraints;
        this.builder = builder;
        return builder.model;
    }
}
exports.default = Translator;
