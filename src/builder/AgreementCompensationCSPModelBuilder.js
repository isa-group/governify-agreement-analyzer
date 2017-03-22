/*!
governify-agreement-analyzer 0.1.1, built on: 2017-03-16
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
const CSPTools = require("E:\\Documents\\Coding\\CSP\\governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const cspConfig = CSPTools.config;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");
class AgreementCompensationCSPModelBuilder {
    constructor(agreement) {
        this.agreement = agreement;
        this.cspModel = new CSPModel();
        this.guaranteePenaltyRewardCache = {};
        this.loadGuarantees();
    }
    loadGuarantees() {
        this.loadMetrics();
        this.loadDefinitions();
        this.loadPenaltiesAndRewards();
        this.equalizePenaltyReward();
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
                    expr += " \\/ ";
                }
                expr += "(" + Penalty_1.default.getCFC1(_of.penalties) + " xor " + Reward_1.default.getCFC1(_of.rewards) + " xor " +
                    Penalty_1.default.getCFC2(_of.penalties) + " xor " + Reward_1.default.getCFC2(_of.rewards) + ")";
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
        let mockSuffix = "2";
        var mockBuilder = this.getMockInstance(mockSuffix);
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
                let penalRewardProductExpr = "not (" + _pthis.guaranteePenaltyRewardCache[g.id].penalties
                    .concat(_pthis.guaranteePenaltyRewardCache[g.id].rewards)
                    .join(" * ") + " == 0)";
                if (expr !== "") {
                    expr += " \\/ ";
                }
                expr += "(" + penalCompareExpr + " \\/ " + rewardCompareExpr + " \\/ " + penalRewardProductExpr + ")";
            });
            return new CSPTools.CSPConstraint("ccc_3", expr);
        });
        let cccConstraints4 = this.guarantees.map((g, gi) => {
            return g.ofs.map((_of, _ofi) => {
                let utility = _pthis.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression_1.default(_of.objective));
                let mockUtility = mockBuilder.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression_1.default(_of.objective));
                mockUtility.var.id = mockUtility.var.id + mockSuffix;
                let expression = new Expression_1.default(mockUtility.constraint.expression);
                expression.variables = new Set([...expression.variables].map((_v) => _pthis.cspModel.variables.push(_v + mockSuffix)));
                mockUtility.constraint = expression.getMockExpression(mockSuffix);
                mockBuilder.cspModel.variables.push(utility.var);
                mockBuilder.cspModel.constraints.push(utility.constraint);
                mockBuilder.cspModel.variables.push(mockUtility.var);
                mockBuilder.cspModel.constraints.push(mockUtility.constraint);
                return utility.var.id + " > " + mockUtility.var.id;
            });
        });
        let cspModel = new CSPModel();
        cspModel.variables = mockBuilder.cspModel.variables;
        cspModel.constraints = cccConstraints1.map((c, ci) => {
            return new CSPTools.CSPConstraint("ccc_" + ci, c.expression + " /\\ " +
                cccConstraints2[ci].expression + " /\\ " +
                cccConstraints3[ci].expression + " /\\ " +
                cccConstraints4[ci].join(" /\\ "));
        });
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
            return new CSPTools.CSPConstraint("csc", "(" + c.expression + ") /\\ (" +
                cscPenaltyConstraints[ci].expression + ") \\/ (" + cscRewardConstraints[ci].expression + ")");
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
            return new CSPTools.CSPConstraint("gcc_" + ci, "(" + c.expression + ") /\\ (" +
                gccPenaltyConstraints[ci].expression + ") /\\ (" + gccRewardConstraints[ci].expression + ")");
        });
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildOGT() {
        return this.buildOptimalThreshold("minimize");
    }
    buildOBT() {
        return this.buildOptimalThreshold("maximize");
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
        utility.var = new CSPTools.CSPVar("ccc_aggregated_utility", new Domain_1.default(0, 1).getRangeOrType());
        utility.constraint = new CSPTools.CSPConstraint("ccc_aggregated_utility", utility.var.id + " == " + aggregatedUtilityFunction);
        this.cspModel.variables.push(utility.var);
        this.cspModel.constraints.push(utility.constraint);
        return utility;
    }
    buildOptimalThreshold(solveType) {
        var _pthis = this;
        let utility = this.loadUtilityFunction();
        let cfc = this.buildCFC();
        let ogtPenaltyConstraints = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("ogt", g.ofs.map((_of, _ofi) => {
                return _of.penalties.map((p) => {
                    return "(" + p.name + " == 0)";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });
        let ogtRewardConstraints = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("ogt", g.ofs.map((_of, _ofi) => {
                return _of.rewards.map((r) => {
                    return "(" + r.name + " == 0)";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = this.cspModel.constraints.concat(cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("ogt_" + ci, "(" + c.expression + ") /\\ (" +
                ogtPenaltyConstraints[ci].expression + ") /\\ (" + ogtRewardConstraints[ci].expression + ")");
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
        utility.var = new CSPTools.CSPVar(name, new CSPTools.CSPRange(0, 1));
        utility.constraint = new CSPTools.CSPConstraint(utility.var.id, "(" + utility.var.id + " == 1 /\\ (" + expression.expr + ")) xor (" +
            utility.var.id + " == 0 /\\ not (" + expression.expr + "))");
        return utility;
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
            _pthis.definitions.push(new Definition_1.default(defName, domain));
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(defName, domain.getRangeOrType()));
        });
    }
    addPenaltyToCache(guarantee, penalty) {
        var _id = guarantee.id;
        if (!(_id in this.guaranteePenaltyRewardCache)) {
            this.guaranteePenaltyRewardCache[_id] = { penalties: [], rewards: [] };
        }
        this.guaranteePenaltyRewardCache[_id].penalties.push(penalty.name);
    }
    addRewardToCache(guarantee, reward) {
        var _id = guarantee.id;
        if (!(_id in this.guaranteePenaltyRewardCache)) {
            this.guaranteePenaltyRewardCache[_id] = { penalties: [], rewards: [] };
        }
        this.guaranteePenaltyRewardCache[_id].rewards.push(reward.name);
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
                    ofi.penalties.forEach((p, index) => {
                        var def = _pthis.definitions.filter((d) => d.name === Object.keys(p.over)[0])[0];
                        p.of.forEach((pofi, ofindex) => {
                            var newPenalty = new Penalty_1.default(g.id + index + ofindex, def, pofi.value, new Expression_1.default(pofi.condition), new Expression_1.default(ofi.objective));
                            penalties.push(newPenalty);
                            _pthis.addPenaltyToCache(g, newPenalty);
                            _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                        });
                    });
                }
                if (ofi.rewards) {
                    ofi.rewards.forEach((r, index) => {
                        var def = _pthis.definitions.filter((d) => d.name === Object.keys(r.over)[0])[0];
                        r.of.forEach((rofi, ofindex) => {
                            var newReward = new Reward_1.default(g.id + index + ofindex, def, rofi.value, new Expression_1.default(rofi.condition), new Expression_1.default(ofi.objective));
                            rewards.push(newReward);
                            _pthis.addRewardToCache(g, newReward);
                            _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                        });
                    });
                }
                objectives.push(new Objective_1.default(ofi.objective, penalties, rewards));
            });
            _pthis.guarantees.push(new Guarantee_1.default(g.id, objectives));
        });
    }
    equalizePenaltyReward() {
        var _pthis = this;
        this.guarantees.forEach((g, gi) => {
            g.ofs.forEach((_of, _ofi) => {
                if (_of.penalties.length === 0) {
                    let def = _pthis.getPricingPenalty();
                    let newPenalty = new Penalty_1.default(g.id + gi + _ofi, def, 0, new Expression_1.default("true"), new Expression_1.default(_of.objective));
                    _of.penalties.push(newPenalty);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                }
                if (_of.rewards.length === 0) {
                    let def = _pthis.getPricingReward();
                    let newReward = new Reward_1.default(g.id + gi + _ofi, def, 0, new Expression_1.default("true"), new Expression_1.default(_of.objective));
                    _of.rewards.push(newReward);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                }
            });
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
            var objectives = [];
            g.ofs.forEach((ofi) => {
                var penalties = ofi.penalties.map((p) => {
                    if (!mockBuilder.existVariable(p.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(p.name, p.over.domain.getRangeOrType()));
                    }
                    p.condition.expr = p.condition.getMockExpression(mockSuffix);
                    p.condition.variables.forEach((v) => {
                        if (!mockBuilder.existVariable(v + mockSuffix)) {
                            let met = mockBuilder.getMetricByName(v + mockSuffix);
                            mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                        }
                    });
                    return p;
                });
                var rewards = ofi.rewards.map((r) => {
                    if (!mockBuilder.existVariable(r.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(r.name, r.over.domain.getRangeOrType()));
                    }
                    r.condition.expr = r.condition.getMockExpression(mockSuffix);
                    r.condition.variables.forEach((v) => {
                        if (!mockBuilder.existVariable(v + mockSuffix)) {
                            let met = mockBuilder.getMetricByName(v + mockSuffix);
                            mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                        }
                    });
                    return r;
                });
                objectives.push(new Objective_1.default(ofi.objective, penalties, rewards));
            });
            return new Guarantee_1.default(g.id, objectives);
        });
        return mockBuilder;
    }
    existVariable(name) {
        return this.cspModel.variables.filter((_v) => _v.id === name).length > 0;
    }
    getDefinitionByName(name) {
        var ret;
        let defs = this.definitions.filter((d) => name === d.name);
        if (defs.length > 0) {
            ret = defs[0];
        }
        return ret;
    }
    getMetricByName(name) {
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
