/*!
governify-agreement-analyzer 0.5.6, built on: 2017-07-06
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


import CSPBuilder from "../builder/csp/CSPBuilder";
import IBuilder from "./IBuilder";

const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const CSPParameter = CSPTools.CSPParameter;
const CSPVar = CSPTools.CSPVar;
const CSPConstraint = CSPTools.CSPConstraint;

export default class Translator {

	builder: IBuilder;

	constructor(builder: IBuilder) {
		this.builder = builder;
	}

	translate(agModel: Object): typeof CSPModel {

		var parameters: Array<typeof CSPParameter> = [];
		var variables: Array<typeof CSPVar> = [];
		var constraints: Array<typeof CSPConstraint> = [];

		var definitions = agModel["context"]["definitions"]["schemas"];
		Object.keys(definitions).forEach(function (name: string) {
			variables.push(new CSPVar(name, definitions[name]["type"]));
		});

		var metrics = agModel["terms"]["metrics"];
		Object.keys(metrics).forEach(function (name: string) {
			variables.push(new CSPVar(name, metrics[name]["schema"]["type"]));
		});

		var guarantees = agModel["terms"]["guarantees"];
		guarantees.forEach(function (guarantee: any) {
			guarantee.of.forEach(function (of: any, index: number) {
				var constraint: typeof CSPConstraint;
				var constId: string = guarantee.id + "_" + index;
				if (of.precondition && of.precondition !== "") {
					// Use "precondition->objective" to define constraint
					constraint = new CSPConstraint(constId, "(" + of.precondition + ") -> (" + of.objective + ")");
				} else if (of.objective && of.objective !== "") {
					// Use "objective" property to define constraint
					constraint = new CSPConstraint(constId, of.objective);
				}
				constraints.push(constraint);
			});
		});

		var builder = new CSPBuilder();
		builder.model.variables = variables;
		builder.model.constraints = constraints;

		this.builder = builder;

		return builder.model;
	}

	// translate(model: AgreementModel): AbstractModel{
	// try {
	// 	declare var _builder: typeof IBuilder;
	// 	_builder.docType(model.docType());
	// 	builder = _builder;
	// 	translate(model, builder);
	// 	return builder.getModel();
	// } catch (InstantiationException | IllegalAccessException e) {
	// 	LOG.log(Level.WARNING, "translate_AgreementModel exception", e);
	// }
	// return null;
	// }
}