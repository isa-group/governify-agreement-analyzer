/*!
governify-agreement-analyzer 0.2.0, built on: 2017-03-27
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
const Metric_1 = require("../model/Metric");
const Penalty_1 = require("../model/Penalty");
const Reward_1 = require("../model/Reward");
const Definition_1 = require("../model/Definition");
const Expression_1 = require("../model/Expression");
const Domain_1 = require("../model/Domain");
const Guarantee_1 = require("../model/Guarantee");
const Objective_1 = require("../model/Objective");
const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const cspConfig = CSPTools.config;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");
const jsep = require("jsep");
class AgreementCompensationCSPModelBuilder {
    constructor(agreement, mockSuffix) {
        this.agreement = agreement;
        this.mockSuffix = mockSuffix;
        if (mockSuffix) {
            this.mock = true;
        }
        this.cspModel = new CSPModel();
        this.guaranteePenaltyRewardCache = {};
        this.loadGuarantees();
    }
    loadGuarantees() {
        this.loadMetrics();
        this.loadDefinitions();
        this.loadPenaltiesAndRewards();
    }
    buildConstraints() {
        var constraints = [];
        this.loadConstraints();
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = this.cspModel.constraints;
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildCFC() {
        let cfcConstraints = this.guarantees.map((g, gi) => {
            var expr = "";
            g.ofs.forEach((_of) => {
                if (expr !== "") {
                    expr += " /\\ ";
                }
                expr += "(((" + Penalty_1.default.getCFC1(_of.penalties) + ") xor (" + Penalty_1.default.getCFC2(_of.penalties) + ")) /\\ ((" +
                    Reward_1.default.getCFC1(_of.rewards) + ") xor (" + Reward_1.default.getCFC2(_of.rewards) + ")))";
            });
            return new CSPTools.CSPConstraint("cfc_" + g.id + gi, expr);
        });
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfcConstraints;
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildCCC() {
        var mockBuilder = new AgreementCompensationCSPModelBuilder(this.agreement, "2");
        var _pthis = this;
        let cccConstraints1 = this.buildCFC().constraints;
        let cccConstraints2 = mockBuilder.buildCFC().constraints;
        let cccConstraints3 = this.guarantees.map((g, gi) => {
            var expr = "";
            g.ofs.forEach((_of, _ofi) => {
                let penalCompareExpr = _of.penalties.map((p, pi) => {
                    return "(" + p.name + " > " + mockBuilder.guarantees[gi].ofs[_ofi].penalties[pi].name + ")";
                }).join(" /\\ ");
                let rewardCompareExpr = _of.rewards.map((p, pi) => {
                    return "(" + p.name + " < " + mockBuilder.guarantees[gi].ofs[_ofi].rewards[pi].name + ")";
                }).join(" /\\ ");
                if (expr !== "") {
                    expr += " /\\ ";
                }
                expr += "(" + penalCompareExpr + " \\/ " + rewardCompareExpr + ")";
            });
            return new CSPTools.CSPConstraint("ccc_3", expr);
        });
        let cccConstraints4 = this.guarantees.map((g, gi) => {
            return g.ofs.map((_of, _ofi) => {
                let utility = _pthis.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression_1.default(_of.objective));
                let mockUtility = mockBuilder.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, _pthis.getMockValue(new Expression_1.default(_of.objective)));
                mockUtility.var.id = mockBuilder.getMockValue(utility.var.id);
                let expression = new Expression_1.default(utility.constraint.expression);
                mockUtility.constraint.expression = mockBuilder.getMockValue(new Expression_1.default(utility.constraint.expression)).expr;
                mockBuilder.cspModel.variables.push(utility.var);
                mockBuilder.cspModel.constraints.push(utility.constraint);
                mockBuilder.cspModel.variables.push(mockUtility.var);
                mockBuilder.cspModel.constraints.push(mockUtility.constraint);
                return utility.var.id + " > " + mockUtility.var.id;
            });
        });
        let cspModel = new CSPModel();
        cspModel.variables = [...this.cspModel.variables, ...mockBuilder.cspModel.variables];
        cspModel.constraints = [...mockBuilder.cspModel.constraints, ...cccConstraints1.map((c, ci) => {
                return new CSPTools.CSPConstraint("ccc_" + ci, c.expression + " /\\ " +
                    cccConstraints2[ci].expression + " /\\ " +
                    cccConstraints3[ci].expression + " /\\ " +
                    cccConstraints4[ci].join(" /\\ "));
            })];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildCSC() {
        let cfc = this.buildCFC();
        let cscPenaltyConstraints = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("csc", g.ofs.map((_of, _ofi) => {
                return _of.penalties.map((p) => {
                    return "(" + p.name + " == " + p.over.domain.max + ")";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });
        let cscRewardConstraints = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("csc", g.ofs.map((_of, _ofi) => {
                return _of.rewards.map((r) => {
                    return "(" + r.name + " == " + r.over.domain.max + ")";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("csc", "(" + c.expression + ") /\\ ((" +
                cscPenaltyConstraints[ci].expression + ") \\/ (" + cscRewardConstraints[ci].expression + "))");
        });
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildGCC() {
        let cfc = this.buildCFC();
        let gccPenaltyConstraints = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("gcc", g.ofs.map((_of, _ofi) => {
                return _of.penalties.map((p) => {
                    return "(" + p.name + " > 0 /\\ (" + p.objective.expr + "))";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });
        let gccRewardConstraints = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("gcc", g.ofs.map((_of, _ofi) => {
                return _of.rewards.map((r) => {
                    return "(" + r.name + " > 0 /\\ not (" + r.objective.expr + "))";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("gcc_" + ci, "(" + c.expression + ") /\\ ((" +
                gccPenaltyConstraints[ci].expression + ") \\/ (" + gccRewardConstraints[ci].expression + "))");
        });
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildOGT() {
        return this.buildOptimalThreshold("OGT", "minimize");
    }
    buildOBT() {
        return this.buildOptimalThreshold("OBT", "maximize");
    }
    loadUtilityFunction() {
        var _pthis = this;
        let aggregatedUtilityFunction = "(" + this.guarantees.map((g, gi) => {
            return "(" + g.ofs.map((_of, _ofi) => {
                let utility = _pthis.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression_1.default(_of.objective));
                _pthis.cspModel.variables.push(utility.var);
                _pthis.cspModel.constraints.push(utility.constraint);
                return utility.var.id;
            }).join(" + ") + ")";
        }).join(" + ") + ")";
        let utility = {};
        utility.var = new CSPTools.CSPVar("ccc_aggregated_utility", "int");
        utility.constraint = new CSPTools.CSPConstraint("ccc_aggregated_utility", utility.var.id + " == " + aggregatedUtilityFunction);
        this.cspModel.variables.push(utility.var);
        this.cspModel.constraints.push(utility.constraint);
        return utility;
    }
    buildOptimalThreshold(operationName, solveType) {
        var _pthis = this;
        let utility = this.loadUtilityFunction();
        let cfc = this.buildCFC();
        var penaltyOrRewardsConstraints;
        operationName = operationName.toLowerCase();
        if (operationName === "ogt") {
            penaltyOrRewardsConstraints = this.guarantees.map((g, gi) => {
                return new CSPTools.CSPConstraint("ogt", g.ofs.map((_of, _ofi) => {
                    return _of.penalties.map((p) => {
                        return "(" + p.name + " == 0)";
                    }).join(" /\\ ");
                }).join(" /\\ "));
            });
        }
        else if (operationName === "obt") {
            penaltyOrRewardsConstraints = this.guarantees.map((g, gi) => {
                return new CSPTools.CSPConstraint("ogt", g.ofs.map((_of, _ofi) => {
                    return _of.rewards.map((r) => {
                        return "(" + r.name + " == 0)";
                    }).join(" /\\ ");
                }).join(" /\\ "));
            });
        }
        else {
            throw new Error("Agreement compensation internal error, operation type should be set \"OGT\" or \"OBT\"");
        }
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = this.cspModel.constraints.concat(cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("ogt_" + ci, "(" + c.expression + ") /\\ (" +
                penaltyOrRewardsConstraints[ci].expression + ")");
        }));
        if (this.metrics.length === 0) {
            throw "Unable to find a metric to minimize";
        }
        else {
            cspModel.goal = solveType + " " + utility.var.id;
        }
        return cspModel;
    }
    getUtilityFunction(name, expression) {
        var utility = {};
        var variables = expression.variables;
        var expressionVar = [...variables][0];
        let metricUtil = this.getMetricByName(expressionVar);
        utility.var = new CSPTools.CSPVar(name, new Domain_1.default("-" + metricUtil.domain.max, metricUtil.domain.max));
        var parserTree = jsep(expression.expr);
        if (parserTree.type === "BinaryExpression") {
            if (parserTree.left.type === "Identifier") {
                if (parserTree.operator === "<" || parserTree.operator === "<=") {
                    expressionVar = "-" + expressionVar;
                }
            }
            else {
                if (parserTree.operator === ">" || parserTree.operator === ">=") {
                    expressionVar = "-" + expressionVar;
                }
            }
        }
        utility.constraint = new CSPTools.CSPConstraint(utility.var.id, name + " == " + expressionVar);
        return utility;
    }
    getMockValue(v) {
        if (typeof v === "string") {
            return this.mock ? v + this.mockSuffix : v;
        }
        else {
            let expr = v;
            return this.mock ? new Expression_1.default(expr.getMockExpression(this.mockSuffix)) : v;
        }
    }
    loadMetrics() {
        let metricNames = Object.keys(this.agreement.terms.metrics);
        this.metrics = [];
        var _pthis = this;
        metricNames.forEach((metricName) => {
            var min = _pthis.agreement.terms.metrics[metricName].schema.minimum;
            var max = _pthis.agreement.terms.metrics[metricName].schema.maximum;
            var type = _pthis.agreement.terms.metrics[metricName].schema.type;
            var domain = (isNaN(min) || isNaN(max)) ? new Domain_1.default(type) : new Domain_1.default(min, max);
            metricName = _pthis.getMockValue(metricName);
            _pthis.metrics.push(new Metric_1.default(metricName, domain));
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(metricName, domain.getRangeOrType()));
        });
    }
    loadDefinitions() {
        let definitionNames = Object.keys(this.agreement.context.definitions.schemas);
        this.definitions = [];
        var _pthis = this;
        definitionNames.forEach((defName) => {
            var min = _pthis.agreement.context.definitions.schemas[defName].minimum;
            var max = _pthis.agreement.context.definitions.schemas[defName].maximum;
            var type = _pthis.agreement.context.definitions.schemas[defName].type;
            var domain = (isNaN(min) || isNaN(max)) ? new Domain_1.default(type) : new Domain_1.default(min, max);
            defName = _pthis.getMockValue(defName);
            _pthis.definitions.push(new Definition_1.default(defName, domain));
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(defName, domain.getRangeOrType()));
        });
    }
    loadPenaltiesAndRewards() {
        var _pthis = this;
        this.guarantees = [];
        this.agreement.terms.guarantees.forEach((g) => {
            var objectives = [];
            g.of.forEach((ofi) => {
                var penalties = [];
                var rewards = [];
                if (ofi.penalties) {
                    ofi.penalties.forEach((p, pi) => {
                        var def = _pthis.definitions.filter((d) => d.name === _pthis.getMockValue(Object.keys(p.over)[0]))[0];
                        var penalCondition = "";
                        var arrayValues = [];
                        p.of.forEach((pofi) => {
                            arrayValues.push({
                                value: pofi.value,
                                condition: _pthis.getMockValue(new Expression_1.default(pofi.condition))
                            });
                        });
                        var newPenalty = new Penalty_1.default(_pthis.getMockValue(g.id + "_penalty" + pi), def, arrayValues, _pthis.getMockValue(new Expression_1.default(ofi.objective)));
                        penalties.push(newPenalty);
                        _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                    });
                }
                else {
                    let def = _pthis.getPricingPenalty();
                    let newPenalty = new Penalty_1.default(_pthis.getMockValue(g.id + "_penalty0"), def, [{ value: 0, condition: new Expression_1.default("true") }], _pthis.getMockValue(new Expression_1.default(ofi.objective)));
                    penalties.push(newPenalty);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                }
                if (ofi.rewards) {
                    ofi.rewards.forEach((r, ri) => {
                        var def = _pthis.definitions.filter((d) => d.name === _pthis.getMockValue(Object.keys(r.over)[0]))[0];
                        var penalCondition = "";
                        var arrayValues = [];
                        r.of.forEach((rofi) => {
                            arrayValues.push({
                                value: rofi.value,
                                condition: _pthis.getMockValue(new Expression_1.default(rofi.condition))
                            });
                        });
                        var newReward = new Reward_1.default(_pthis.getMockValue(g.id + "_reward" + ri), def, arrayValues, _pthis.getMockValue(new Expression_1.default(ofi.objective)));
                        rewards.push(newReward);
                        _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                    });
                }
                else {
                    let def = _pthis.getPricingReward();
                    let newReward = new Reward_1.default(_pthis.getMockValue(g.id + "_reward0"), def, [{ value: 0, condition: new Expression_1.default("true") }], _pthis.getMockValue(new Expression_1.default(ofi.objective)));
                    rewards.push(newReward);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                }
                objectives.push(new Objective_1.default(ofi.objective, penalties, rewards));
            });
            _pthis.guarantees.push(new Guarantee_1.default(g.id, objectives));
        });
    }
    loadConstraints() {
        var _pthis = this;
        this.agreement.terms.guarantees.forEach(function (g, gi) {
            g.of.forEach(function (of, ofi) {
                var _id = "C" + gi + "_" + ofi;
                if (of.precondition && of.precondition !== "") {
                    _pthis.cspModel.constraints.push(new CSPTools.CSPConstraint(_id, "(" + of.precondition + ") -> (" + of.objective + ")"));
                }
                else if (of.objective && of.objective !== "") {
                    _pthis.cspModel.constraints.push(new CSPTools.CSPConstraint(_id, of.objective));
                }
                else {
                    logger.info("Unable to load constraint: " + _id);
                }
            });
        });
    }
    getMockInstance(mockSuffix) {
        var mockBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);
        mockBuilder.definitions = mockBuilder.definitions.map((def) => {
            def.name = def.name + mockSuffix;
            return def;
        });
        mockBuilder.metrics = mockBuilder.metrics.map((met) => {
            met.name = met.name + mockSuffix;
            return met;
        });
        mockBuilder.guarantees = mockBuilder.guarantees.map((g) => {
            var objectives = g.ofs.map((ofi) => {
                var penalties = ofi.penalties.map((p) => {
                    if (!mockBuilder.existVariable(p.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(p.name, p.over.domain.getRangeOrType()));
                    }
                    if (!mockBuilder.existVariable(p.name + mockSuffix)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(p.name + mockSuffix, p.over.domain.getRangeOrType()));
                    }
                    p.valueCondition.forEach((vc, index) => {
                        vc.condition.expr = vc.condition.getMockExpression(mockSuffix);
                        vc.condition.variables.forEach((v) => {
                            if (!mockBuilder.existVariable(v + mockSuffix)) {
                                let met = mockBuilder.getMetricByName(v + mockSuffix);
                                mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                            }
                        });
                    });
                    return p;
                });
                var rewards = ofi.rewards.map((r) => {
                    if (!mockBuilder.existVariable(r.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(r.name, r.over.domain.getRangeOrType()));
                    }
                    if (!mockBuilder.existVariable(r.name + mockSuffix)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(r.name + mockSuffix, r.over.domain.getRangeOrType()));
                    }
                    r.valueCondition.forEach((vc, index) => {
                        vc.condition.expr = vc.condition.getMockExpression(mockSuffix);
                        vc.condition.variables.forEach((v) => {
                            if (!mockBuilder.existVariable(v + mockSuffix)) {
                                let met = mockBuilder.getMetricByName(v + mockSuffix);
                                mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                            }
                        });
                    });
                    return r;
                });
                return new Objective_1.default(ofi.objective, penalties, rewards);
            });
            return new Guarantee_1.default(g.id, objectives);
        });
        return mockBuilder;
    }
    existVariable(name) {
        return this.cspModel.variables.filter((_v) => _v.id === name).length > 0;
    }
    getDefinitionByName(name) {
        name = this.getMockValue(name);
        var ret;
        let defs = this.definitions.filter((d) => name === d.name);
        if (defs.length > 0) {
            ret = defs[0];
        }
        return ret;
    }
    getMetricByName(name) {
        name = this.getMockValue(name);
        var ret;
        let mets = this.metrics.filter((d) => name === d.name);
        if (mets.length > 0) {
            ret = mets[0];
        }
        return ret;
    }
    getPricingPenalty() {
        return this.getDefinitionByName(Object.keys(this.agreement.terms.pricing.billing.penalties[0].over)[0]);
    }
    getPricingReward() {
        var rewards = this.agreement.terms.pricing.billing.rewards;
        var def;
        if (!rewards) {
            def = this.getPricingPenalty();
        }
        else {
            def = this.getDefinitionByName(Object.keys(this.agreement.terms.pricing.billing.rewards[0].over)[0]);
        }
        return def;
    }
}
exports.default = AgreementCompensationCSPModelBuilder;
