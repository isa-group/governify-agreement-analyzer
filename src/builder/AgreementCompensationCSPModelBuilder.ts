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


import Metric from "../model/Metric";
import Penalty from "../model/Penalty";
import Reward from "../model/Reward";
import Definition from "../model/Definition";
import Expression from "../model/Expression";
import Domain from "../model/Domain";

const CSPTools = require("E:\\Documents\\Coding\\CSP\\governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const cspConfig = CSPTools.config;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");

export default class AgreementCompensationCSPModelBuilder {

    metrics: Metric[];
    definitions: Definition[];
    penalties: Penalty[];
    rewards: Reward[];
    cspModel: typeof CSPModel;

    constructor(private agreement: any) {
        this.cspModel = new CSPModel();
        this.loadMetrics();
        this.loadDefinitions();
        this.loadPenalties();
        this.loadRewards();
    }

    buildConstraints(): typeof CSPModel {
        var constraints = [];

        this.loadConstraints();

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = this.cspModel.constraints;
        cspModel.goal = "satisfy";

        return cspModel;


    }

    buildCFC(): typeof CSPModel {

        let cfcPenalties = this.penalties.map((p) => {
            return p.getCFC();
        });

        let cfcRewards = this.rewards.map((r) => {
            return r.getCFC();
        });

        let cfc = cfcPenalties.concat(cfcRewards);

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [new CSPTools.CSPConstraint("cfc", cfc.join(" xor "))];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    static mockSuffix: string = "2";
    buildCCC(): typeof CSPModel {

        // Create mock builder
        var mockBuilder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
        mockBuilder.definitions = mockBuilder.definitions.map((def) => {
            def.name = def.name + AgreementCompensationCSPModelBuilder.mockSuffix;
            return def;
        });
        mockBuilder.metrics = mockBuilder.metrics.map((met) => {
            met.name = met.name + AgreementCompensationCSPModelBuilder.mockSuffix;
            return met;
        });
        mockBuilder.penalties = mockBuilder.penalties.map((p) => {
            if (mockBuilder.cspModel.variables.filter((_p) => p.name === _p.id).length === 0) {
                mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(
                    p.name, new CSPTools.CSPRange(p.over.domain.min, p.over.domain.max)
                ));
            }
            p.condition.expr = p.condition.getMockExpression(AgreementCompensationCSPModelBuilder.mockSuffix);
            p.condition.variables.forEach((v) => {
                if (mockBuilder.cspModel.variables.filter((_v) => _v.id === v + AgreementCompensationCSPModelBuilder.mockSuffix).length === 0) {
                    mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(
                        v + AgreementCompensationCSPModelBuilder.mockSuffix, new CSPTools.CSPRange(p.over.domain.min, p.over.domain.max)
                    ));
                }
            });
            return p;
        });
        mockBuilder.rewards = mockBuilder.rewards.map((r) => {
            if (mockBuilder.cspModel.variables.filter((_r) => r.name === _r.id).length === 0) {
                mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(
                    r.name, new CSPTools.CSPRange(r.over.domain.min, r.over.domain.max)
                ));
            }
            r.condition.expr = r.condition.getMockExpression(AgreementCompensationCSPModelBuilder.mockSuffix);
            r.condition.variables.forEach((v) => {
                if (mockBuilder.cspModel.variables.filter((_v) => _v.id === v + AgreementCompensationCSPModelBuilder.mockSuffix).length === 0) {
                    mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(
                        v + AgreementCompensationCSPModelBuilder.mockSuffix, new CSPTools.CSPRange(r.over.domain.min, r.over.domain.max)
                    ));
                }
            });
            return r;
        });

        var penaltiesORRewardsConst = ""; // (p1 > p2 OR r1 < r2)
        for (var i = 0; i < this.penalties.length; i++) {
            if (penaltiesORRewardsConst !== "") {
                penaltiesORRewardsConst += " /\\ ";
            }
            penaltiesORRewardsConst += "((" + this.penalties[i].name + " > " + mockBuilder.penalties[i].name + ") \\/ (" +
                this.rewards[i].name + " < " + mockBuilder.rewards[i].name + "))";
        }

        var utilityConst = ""; // (Utility(m1) > Utility(m2))
        for (var i = 0; i < this.metrics.length; i++) {
            if (utilityConst !== "") {
                utilityConst += " /\\ ";
            }
            utilityConst += "(-(" + this.metrics[i].name + ") > -(" + mockBuilder.metrics[i].name + "))";
        }

        let cfc1 = this.buildCFC(); // CFC(m1,p1,r1,{CondP},{AsigP},{CondR},{AsigR})
        let cfc2 = mockBuilder.buildCFC(); // CFC(m2,p2,r2,{CondP},{AsigP},{CondR},{AsigR})

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = mockBuilder.cspModel.variables;
        cspModel.constraints = [new CSPTools.CSPConstraint("ccc", cfc1.constraints[0].expression + " /\\ " + cfc2.constraints[0].expression +
            " /\\ " + penaltiesORRewardsConst + " /\\ " + utilityConst)];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    buildCSC(): typeof CSPModel {

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

        let penalties = this.penalties.map((p) => { // (p = max(domain(p))
            return "(" + p.name + " == " + p.over.domain.max + ")";
        });

        let rewards = this.rewards.map((r) => { // (r = max(domain(r)))
            return "(" + r.name + " == " + r.over.domain.max + ")";
        });

        var penaltyRewardConst = "";
        for (var i = 0; i < penalties.length; i++) {
            if (penaltyRewardConst !== "") {
                penaltyRewardConst += " /\\ ";
            }
            penaltyRewardConst += "(" + penalties[i] + " \\/ " + rewards[i] + ")";
        }

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [new CSPTools.CSPConstraint("csc", cfc.constraints[0].expression + " /\\ " + penaltyRewardConst)];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    buildGCC(): typeof CSPModel {

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

        let penalties = this.penalties.map((p) => { // (p = max(domain(p))
            return "(" + p.name + " > 0 /\\ (" + p.objective.expr + "))";
        });

        let rewards = this.rewards.map((r) => { // (r = max(domain(r)))
            return "(" + r.name + " > 0 /\\ not (" + r.objective.expr + "))";
        });

        var penaltyRewardConst = "";
        for (var i = 0; i < penalties.length; i++) {
            if (penaltyRewardConst !== "") {
                penaltyRewardConst += " /\\ ";
            }
            penaltyRewardConst += "(" + penalties[i] + " /\\ " + rewards[i] + ")";
        }

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [new CSPTools.CSPConstraint("gcc", cfc.constraints[0].expression + " /\\ " + penaltyRewardConst)];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    buildOGT(): typeof CSPModel {

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

        let penalties = this.penalties.map((p) => { // (p = max(domain(p))
            return "(" + p.name + " == 0)";
        });

        let rewards = this.rewards.map((r) => { // (r = max(domain(r)))
            return "(" + r.name + " == 0)";
        });

        var penaltyRewardConst = "";
        for (var i = 0; i < penalties.length; i++) {
            if (penaltyRewardConst !== "") {
                penaltyRewardConst += " /\\ ";
            }
            penaltyRewardConst += "(" + penalties[i] + " /\\ " + rewards[i] + ")";
        }

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [new CSPTools.CSPConstraint("ogt", cfc.constraints[0].expression + " /\\ " + penaltyRewardConst)];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    buildOBT(): typeof CSPModel {

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

        let penalties = this.penalties.map((p) => { // (p = max(domain(p))
            return "(" + p.name + " == 0)";
        });

        let rewards = this.rewards.map((r) => { // (r = max(domain(r)))
            return "(" + r.name + " == 0)";
        });

        var penaltyRewardConst = "";
        for (var i = 0; i < penalties.length; i++) {
            if (penaltyRewardConst !== "") {
                penaltyRewardConst += " /\\ ";
            }
            penaltyRewardConst += "(" + penalties[i] + " /\\ " + rewards[i] + ")";
        }

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [new CSPTools.CSPConstraint("obt", cfc.constraints[0].expression + " /\\ " + penaltyRewardConst)];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    private loadMetrics(): void {

        let metricNames = Object.keys(this.agreement.terms.metrics);
        this.metrics = [];
        var _pthis = this;

        metricNames.forEach((metricName) => {

            var min: number = _pthis.agreement.terms.metrics[metricName].schema.minimum;
            var max: number = _pthis.agreement.terms.metrics[metricName].schema.maximum;
            var type: number = _pthis.agreement.terms.metrics[metricName].schema.type;

            // Create CSP Range to define variable on CSP Model.
            if (isNaN(min) || isNaN(max)) {
                // Obtain max and min values for domain
                if (!(type in cspConfig.translator.typeMap)) {
                    throw "Unable to find type \"" + type + "\" of metric \"" + metricName + "\"";
                } else {
                    let cspType: string = cspConfig.translator.typeMap[type];
                    min = minMaxMap[cspType].min;
                    max = minMaxMap[cspType].max;
                }
            }

            _pthis.metrics.push(new Metric(metricName, new Domain(min, max))); // _pthis.agreement.terms.metrics[metricName].schema.type
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(metricName, new CSPTools.CSPRange(min, max)));

        });

    }

    private loadDefinitions(): void {

        let definitionNames = Object.keys(this.agreement.context.definitions.schemas);
        this.definitions = [];
        var _pthis = this;

        definitionNames.forEach((defName) => {

            var min: number = _pthis.agreement.context.definitions.schemas[defName].minimum;
            var max: number = _pthis.agreement.context.definitions.schemas[defName].maximum;
            var type: number = _pthis.agreement.context.definitions.schemas[defName].type;

            // Create CSP Range to define variable on CSP Model.
            if (isNaN(min) || isNaN(max)) {
                // Obtain max and min values for domain
                if (!(type in cspConfig.translator.typeMap)) {
                    throw "Unable to find type \"" + type + "\" of definition \"" + defName + "\"";
                } else {
                    let cspType: string = cspConfig.translator.typeMap[type];
                    min = minMaxMap[cspType].min;
                    max = minMaxMap[cspType].max;
                }
            }

            _pthis.definitions.push(new Definition(defName, new Domain(min, max))); // _pthis.agreement.terms.metrics[metricName].schema.type
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(defName, new CSPTools.CSPRange(min, max)));

        });

    }

    private loadPenalties(): void {
        this.penalties = [];
        var _pthis = this;
        this.agreement.terms.guarantees.forEach((g) => {
            g.of.forEach((ofi) => {
                ofi.penalties.forEach((p) => {
                    var def = _pthis.definitions.filter((d) => d.name === Object.keys(p.over)[0])[0]; // only considers the first "over"
                    var newPenal = new Penalty(g.id, def, p.of[0].value, new Expression(p.of[0].condition), new Expression(ofi.objective));
                    _pthis.penalties.push(newPenal);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenal.name, new CSPTools.CSPRange(def.domain.min, def.domain.max)));
                });
            });
        });
    }

    private loadRewards(): void {
        this.rewards = [];
        var _pthis = this;
        this.agreement.terms.guarantees.forEach((g) => {
            g.of.forEach((ofi) => {
                ofi.rewards.forEach((p) => {
                    var def = _pthis.definitions.filter((d) => d.name === Object.keys(p.over)[0])[0]; // only considers the first "over"
                    var newReward = new Reward(g.id, def, p.of[0].value, new Expression(p.of[0].condition), new Expression(ofi.objective));
                    _pthis.rewards.push(newReward);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, new CSPTools.CSPRange(def.domain.min, def.domain.max)));
                });
            });
        });
    }

    private loadConstraints(): void {
        var _pthis = this;
        this.agreement.terms.guarantees.forEach(function (g: any, gi: number) {
            g.of.forEach(function (of: any, ofi: number) {
                var _id: string = "C" + gi + "_" + ofi;
                if (of.precondition && of.precondition !== "") {
                    // Use "precondition->objective" to define constraint
                    _pthis.cspModel.constraints.push(new CSPTools.CSPConstraint(_id, "(" + of.precondition + ") -> (" + of.objective + ")"));
                } else if (of.objective && of.objective !== "") {
                    // Use "objective" property to define constraint
                    _pthis.cspModel.constraints.push(new CSPTools.CSPConstraint(_id, of.objective));
                } else {
                    logger.info("Unable to load constraint: " + _id);
                }
            });
        });
    }

    /**
     * Tries to obtain definition by name.
     * @param id Definition name
     */
    private getDefinitionByName(id: string): Definition {
        var ret: Definition;
        let defs: Definition[] = this.definitions.filter((d) => id === d.name);
        if (defs.length > 0) {
            ret = defs[0];
        }
        return ret;
    }

}