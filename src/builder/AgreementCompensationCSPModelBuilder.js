"use strict";
/*!
governify-agreement-analyzer 0.6.4, built on: 2017-10-25
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
Object.defineProperty(exports, "__esModule", { value: true });
const Metric_1 = require("../model/Metric");
const Penalty_1 = require("../model/Penalty");
const Reward_1 = require("../model/Reward");
const Definition_1 = require("../model/Definition");
const Expression_1 = require("../model/Expression");
const Domain_1 = require("../model/Domain");
const Guarantee_1 = require("../model/Guarantee");
const Objective_1 = require("../model/Objective");
const Util_1 = require("../util/Util");
const AnalyzerMapOptions_1 = require("../operators/AnalyzerMapOptions");
const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const CSPVar = CSPTools.CSPVar;
const cspConfig = CSPTools.config;
const cspTypeMap = cspConfig.translator.typeMap;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");
const jsep = require("jsep");
class AgreementCompensationCSPModelBuilder {
    constructor(agreement, mockSuffixOrAnalyzerMapOptions, analyzerMapOptions) {
        this.agreement = agreement;
        if (mockSuffixOrAnalyzerMapOptions) {
            if (mockSuffixOrAnalyzerMapOptions && typeof mockSuffixOrAnalyzerMapOptions === "string") {
                this.mockSuffix = mockSuffixOrAnalyzerMapOptions;
                this.mock = true;
            }
            else if (analyzerMapOptions && analyzerMapOptions instanceof AnalyzerMapOptions_1.AnalyzerMapOptions) {
                this.analyzerMapOptions = analyzerMapOptions;
            }
        }
        if (analyzerMapOptions && analyzerMapOptions instanceof AnalyzerMapOptions_1.AnalyzerMapOptions) {
            this.analyzerMapOptions = analyzerMapOptions;
        }
        this.cspModel = new CSPModel();
        this.guaranteePenaltyRewardCache = {};
        this.loadGuarantees();
    }
    loadGuarantees() {
        this.loadFreeAndNotFreeMetrics();
        this.loadMetrics();
        this.loadDefinitions();
        this.loadPenaltiesAndRewards();
    }
    loadFreeAndNotFreeMetrics() {
        this.notFreeMetrics = this.agreement.terms.guarantees.reduce((acc, g) => {
            return acc.concat(g.of.reduce((_acc, ofe) => _acc.concat(Object.keys(ofe.with)), []));
        }, []).filter((e, i, a) => a.indexOf(e) === i);
        this.freeMetrics = Object.keys(this.agreement.terms.metrics).filter(m => this.notFreeMetrics.indexOf(m) === -1);
    }
    isFreeMetric(metricName) {
        return this.freeMetrics.indexOf(metricName) !== -1;
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
        var _pthis = this;
        let cfcConstraints = new CSPTools.CSPConstraint("cfc", this.guarantees.map((g, gi) => _pthis.getCFCExpressionFromGuarantee(g)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [cfcConstraints];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    getCFCExpressionFromGuarantee(guarantee) {
        var _pthis = this;
        return guarantee.ofs.map((_of) => _pthis.getCFCExpressionFromObjective(_of)).join(" \\/ ");
    }
    getCFCExpressionFromObjective(_of) {
        return "(((" + Penalty_1.default.getCFC1(_of.penalties) + ") xor (" + Penalty_1.default.getCFC2(_of.penalties) + ")) /\\ ((" +
            Reward_1.default.getCFC1(_of.rewards) + ") xor (" + Reward_1.default.getCFC2(_of.rewards) + ")))";
    }
    buildVFC() {
        var _pthis = this;
        let vfcConstraints = new CSPTools.CSPConstraint("vfc", this.guarantees.map(g => _pthis.getVFCExpressionFromGuarantee(g)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [vfcConstraints];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    getVFCExpressionFromGuarantee(guarantee) {
        var _pthis = this;
        return guarantee.ofs.map((_of) => _pthis.getVFCExpressionFromObjective(_of)).join(" \\/ ");
    }
    getVFCExpressionFromObjective(_of) {
        let cfc = this.getCFCExpressionFromObjective(_of);
        var penalties = _of.penalties.map(p => p.name);
        var rewards = _of.rewards.map(r => r.name);
        var constraints = "(" + [...penalties, ...rewards].join(" * ") + " > 0)";
        return "(" + cfc + " /\\ " + constraints + ")";
    }
    buildCCC() {
        var mockBuilder = new AgreementCompensationCSPModelBuilder(this.agreement, "2");
        var _pthis = this;
        let cccConstraints = new CSPTools.CSPConstraint("ccc", this.guarantees.map((g, gi) => _pthis.getCCCExpressionFromGuarantee(mockBuilder, g, gi)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = [...this.cspModel.variables, ...mockBuilder.cspModel.variables].filter((e, i, a) => {
            return a.map(mapObj => mapObj["id"]).indexOf(e["id"]) === i;
        });
        cspModel.constraints = [...mockBuilder.cspModel.constraints, cccConstraints];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    getCCCExpressionFromGuarantee(mockBuilder, guarantee, guaranteeIndex) {
        var _pthis = this;
        return guarantee.ofs.map((_of, _ofi) => _pthis.getCCCExpressionFromObjective(mockBuilder, guarantee, guaranteeIndex, _of, _ofi)).join(" \\/ ");
    }
    getCCCExpressionFromObjective(mockBuilder, guarantee, guaranteeIndex, _of, _ofi) {
        let cfc1 = this.getCFCExpressionFromObjective(_of);
        let cfc2 = mockBuilder.getCFCExpressionFromObjective(mockBuilder.guarantees[guaranteeIndex].ofs[_ofi]);
        let penalCompareExpr = "(" + _of.penalties.map((p, pi) => {
            return "(" + p.name + " > " + mockBuilder.getMockValue(p.name) + ")";
        }).join(" /\\ ") + ")";
        let rewardCompareExpr = "(" + _of.rewards.map((r, ri) => {
            return "(" + r.name + " > " + mockBuilder.getMockValue(r.name) + ")";
        }).join(" /\\ ") + ")";
        let objectiveExpression = new Expression_1.default(_of.objective);
        let utilityName = "ccc_utility_" + [...objectiveExpression.variables].join("") + "_" + _ofi;
        let utility = this.getUtilityFunction(utilityName, objectiveExpression);
        let mockUtility = mockBuilder.getUtilityFunction(utilityName, objectiveExpression);
        mockBuilder.cspModel.variables.push(new CSPVar(utility.var.id, utility.var.range.getRangeOrType()));
        mockBuilder.cspModel.constraints.push(utility.constraint);
        mockBuilder.cspModel.variables.push(new CSPVar(mockUtility.var.id, mockUtility.var.range.getRangeOrType()));
        mockBuilder.cspModel.constraints.push(mockUtility.constraint);
        return "(" + cfc1 + " /\\ " + cfc2 + " /\\ (" + penalCompareExpr + " \\/ " + rewardCompareExpr + ") /\\ (" + utility.var.id + " > " + mockUtility.var.id + "))";
    }
    buildCSC() {
        var _pthis = this;
        let cfcConstraints = new CSPTools.CSPConstraint("csc", this.guarantees.map((g, gi) => _pthis.getCSCExpressionFromGuarantee(g)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [cfcConstraints];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    getCSCExpressionFromGuarantee(guarantee) {
        var _pthis = this;
        return guarantee.ofs.map((_of) => _pthis.getCSCExpressionFromObjective(_of)).join(" \\/ ");
    }
    getCSCExpressionFromObjective(_of) {
        let cfc = this.getCFCExpressionFromObjective(_of);
        let cscPenalties = "(" + _of.penalties.map((p) => {
            return "(" + p.name + " == " + p.over.domain.max + ")";
        }).join(" /\\ ") + ")";
        let cscRewards = "(" + _of.rewards.map((r) => {
            return "(" + r.name + " == " + r.over.domain.min + ")";
        }).join(" /\\ ") + ")";
        return "(" + cfc + " /\\ (" + cscPenalties + " \\/ " + cscRewards + "))";
    }
    buildGCC() {
        var _pthis = this;
        let cfcConstraints = new CSPTools.CSPConstraint("gcc", this.guarantees.map((g, gi) => _pthis.getGCCExpressionFromGuarantee(g)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [cfcConstraints];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildVCG() {
        var builderCCG = new AgreementCompensationCSPModelBuilder(this.agreement);
        let ccgConstraints = new CSPTools.CSPConstraint("ccg", builderCCG.guarantees.map((g, gi) => builderCCG.getGCCExpressionFromGuarantee(g)).join(" \\/ "));
        var builderSCF = new AgreementCompensationCSPModelBuilder(this.agreement);
        let scfConstraints = new CSPTools.CSPConstraint("scf", builderSCF.guarantees.map((g, gi) => builderSCF.getCSCExpressionFromGuarantee(g)).join(" \\/ "));
        var builderCCF = new AgreementCompensationCSPModelBuilder(this.agreement);
        var mockBuilder = new AgreementCompensationCSPModelBuilder(this.agreement, "2");
        let ccfConstraints = new CSPTools.CSPConstraint("ccf", builderCCF.guarantees.map((g, gi) => builderCCF.getCCCExpressionFromGuarantee(mockBuilder, g, gi)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = [
            ...builderCCG.cspModel.variables,
            ...builderSCF.cspModel.variables,
            ...builderCCF.cspModel.variables,
            ...mockBuilder.cspModel.variables
        ].filter((e, i, a) => {
            return a.map(mapObj => mapObj["id"]).indexOf(e["id"]) === i;
        });
        let ccgConstraintsExpr = "not (" + ccgConstraints.expression + ")";
        let scfConstraintsExpr = "not (" + scfConstraints.expression + ")";
        let mockBuilderConstraintsExpr = "not (" +
            mockBuilder.cspModel.constraints.map(constraint => {
                return "(" + constraint.expression + ")";
            }).join(" /\\ ") + ")";
        let ccfConstraintsExpr = "not (" + ccfConstraints.expression + ")";
        let expression = ccgConstraintsExpr + " /\\ " +
            scfConstraintsExpr + " /\\ " +
            mockBuilderConstraintsExpr + " /\\ " +
            ccfConstraintsExpr;
        let vcgConstraint = new CSPTools.CSPConstraint("vcg", expression);
        cspModel.constraints = [vcgConstraint];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildVCF() {
        var builderSCF = new AgreementCompensationCSPModelBuilder(this.agreement);
        let scfConstraints = new CSPTools.CSPConstraint("scf", builderSCF.guarantees.map((g, gi) => builderSCF.getCSCExpressionFromGuarantee(g)).join(" \\/ "));
        var builderCCF = new AgreementCompensationCSPModelBuilder(this.agreement);
        var mockBuilder = new AgreementCompensationCSPModelBuilder(this.agreement, "2");
        let ccfConstraints = new CSPTools.CSPConstraint("ccf", builderCCF.guarantees.map((g, gi) => builderCCF.getCCCExpressionFromGuarantee(mockBuilder, g, gi)).join(" \\/ "));
        let cspModel = new CSPModel();
        cspModel.variables = [
            ...builderSCF.cspModel.variables,
            ...builderCCF.cspModel.variables,
            ...mockBuilder.cspModel.variables
        ].filter((e, i, a) => {
            return a.map(mapObj => mapObj["id"]).indexOf(e["id"]) === i;
        });
        let scfConstraintsExpr = "not (" + scfConstraints.expression + ")";
        let mockBuilderConstraintsExpr = "not (" +
            mockBuilder.cspModel.constraints.map(constraint => {
                return "(" + constraint.expression + ")";
            }).join(" /\\ ") + ")";
        let ccfConstraintsExpr = "not (" + ccfConstraints.expression + ")";
        let expression = scfConstraintsExpr + " /\\ " +
            mockBuilderConstraintsExpr + " /\\ " +
            ccfConstraintsExpr;
        let vcfConstraint = new CSPTools.CSPConstraint("vcf", expression);
        cspModel.constraints = [vcfConstraint];
        cspModel.goal = "satisfy";
        return cspModel;
    }
    buildCompensations() {
        return this.buildVCG();
    }
    getGCCExpressionFromGuarantee(guarantee) {
        var _pthis = this;
        return guarantee.ofs.map((_of) => _pthis.getGCCExpressionFromObjective(_of)).join(" \\/ ");
    }
    getGCCExpressionFromObjective(_of) {
        let cfc = this.getCFCExpressionFromObjective(_of);
        let gccPenalties = "(" + _of.penalties.map((p) => {
            return "(" + p.name + " > 0 /\\ (" + p.objective.expr + "))";
        }).join(" /\\ ") + ")";
        let gccRewards = "(" + _of.rewards.map((r) => {
            return "(" + r.name + " < 0 /\\ not (" + r.objective.expr + "))";
        }).join(" /\\ ") + ")";
        return "(" + cfc + " /\\ (" + gccPenalties + " \\/ " + gccRewards + "))";
    }
    buildOGT() {
        return this.buildOptimalThreshold("OGT", "minimize");
    }
    buildOBT() {
        return this.buildOptimalThreshold("OBT", "maximize");
    }
    buildOptimalThreshold(operationName, solveType) {
        var _pthis = this;
        operationName = operationName.toLowerCase();
        let cfc = this.buildCFC();
        let constraints = new CSPTools.CSPConstraint(operationName, this.guarantees.map((g) => _pthis.getOptimalThresholdFromGuarantee(g, operationName)).join(" \\/ "));
        let utility = this.loadAggregatedUtilityFunction();
        let cspModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [...this.cspModel.constraints, constraints];
        if (this.metrics.length === 0) {
            throw "Unable to find any metric to minimize or maximize";
        }
        else {
            cspModel.goal = solveType + " " + utility.var.id;
        }
        return cspModel;
    }
    loadAggregatedUtilityFunction() {
        var _pthis = this;
        let aggregatedUtilityFunction = "(" + this.guarantees.map((g, gi) => {
            return "(" + g.ofs.map((_of, _ofi) => {
                let utility = _pthis.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression_1.default(_of.objective));
                _pthis.cspModel.variables.push(new CSPVar(utility.var.id, utility.var.range.getRangeOrType()));
                _pthis.cspModel.constraints.push(utility.constraint);
                return utility.var.id;
            }).join(" + ") + ")";
        }).join(" + ") + ")";
        let utility = {};
        utility.var = new CSPTools.CSPVar("ccc_aggregated_utility", "int");
        utility.constraint = new CSPTools.CSPConstraint("ccc_aggregated_utility", utility.var.id + " == " + aggregatedUtilityFunction);
        this.cspModel.variables.push(new CSPVar(utility.var.id, utility.var.type));
        this.cspModel.constraints.push(utility.constraint);
        return utility;
    }
    getOptimalThresholdFromGuarantee(guarantee, operationName) {
        var _pthis = this;
        return guarantee.ofs.map((_of) => _pthis.getOptimalThresholdFromObjective(_of, operationName)).join(" \\/ ");
    }
    getOptimalThresholdFromObjective(_of, operationName) {
        let cfc = this.getCFCExpressionFromObjective(_of);
        var constraints = "";
        if (operationName === "ogt") {
            constraints = "(" + _of.penalties.map((p) => {
                return "(" + p.name + " == 0)";
            }).join(" /\\ ") + ")";
        }
        else if (operationName === "obt") {
            constraints = "(" + _of.rewards.map((r) => {
                return "(" + r.name + " == 0)";
            }).join(" /\\ ") + ")";
        }
        else {
            throw new Error("Agreement compensation internal error, operation type should be set \"OGT\" or \"OBT\"");
        }
        return "(" + cfc + " /\\ " + constraints + ")";
    }
    getUtilityFunction(name, expression) {
        name = this.getMockValue(name);
        expression = this.getMockValue(expression);
        var utility = {};
        var variables = expression.variables;
        var expressionVar = [...variables][0];
        let metricUtil = this.getMetricByName(expressionVar);
        utility.var = new CSPTools.CSPVar(name, new Domain_1.default("-" + metricUtil.domain.getRangeOrType().max, metricUtil.domain.getRangeOrType().max));
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
            return this.mock && !this.isFreeMetric(v) ? v + this.mockSuffix : v;
        }
        else {
            let expr = v;
            return this.mock ? new Expression_1.default(expr.getMockExpression(this.mockSuffix, { keepOriginal: this.freeMetrics })) : v;
        }
    }
    loadMetrics() {
        let metricNames = Object.keys(this.agreement.terms.metrics);
        this.metrics = [];
        var _pthis = this;
        metricNames.forEach((metricName) => {
            var type = _pthis.agreement.terms.metrics[metricName].schema.type;
            if (cspTypeMap[type] !== "string" && cspTypeMap[type] !== "bool") {
                let _min = _pthis.agreement.terms.metrics[metricName].schema.minimum;
                let _max = _pthis.agreement.terms.metrics[metricName].schema.maximum;
                var min;
                var max;
                if (cspTypeMap[type] === "float") {
                    min = isNaN(_min) ? minMaxMap[cspTypeMap[type]].min : Util_1.default.toStringFloat(_min);
                    max = isNaN(_max) ? minMaxMap[cspTypeMap[type]].max : Util_1.default.toStringFloat(_max);
                }
                else {
                    min = isNaN(_min) ? minMaxMap[cspTypeMap[type]].min : _min.toString();
                    max = isNaN(_max) ? minMaxMap[cspTypeMap[type]].max : _max.toString();
                }
                var domain = (isNaN(Number(min)) || isNaN(Number(max))) ? new Domain_1.default(type) : new Domain_1.default(min, max);
                metricName = _pthis.getMockValue(metricName);
                _pthis.metrics.push(new Metric_1.default(metricName, domain));
                _pthis.cspModel.variables.push(new CSPTools.CSPVar(metricName, domain.getRangeOrType()));
            }
        });
    }
    loadDefinitions() {
        let definitionNames = Object.keys(this.agreement.context.definitions.schemas);
        this.definitions = [];
        var _pthis = this;
        definitionNames.forEach((defName) => {
            var type = _pthis.agreement.context.definitions.schemas[defName].type;
            if (cspTypeMap[type] !== "string" && cspTypeMap[type] !== "bool") {
                let _min = _pthis.agreement.context.definitions.schemas[defName].minimum;
                let _max = _pthis.agreement.context.definitions.schemas[defName].maximum;
                var min;
                var max;
                if (cspTypeMap[type] === "float") {
                    min = isNaN(_min) ? minMaxMap[cspTypeMap[type]].min : Util_1.default.toStringFloat(_min);
                    max = isNaN(_max) ? minMaxMap[cspTypeMap[type]].max : Util_1.default.toStringFloat(_max);
                }
                else {
                    min = isNaN(_min) ? minMaxMap[cspTypeMap[type]].min : Util_1.default.toStringFloat(_min);
                    max = isNaN(_max) ? minMaxMap[cspTypeMap[type]].max : Util_1.default.toStringFloat(_max);
                }
                var domain = (isNaN(Number(min)) || isNaN(Number(max))) ? new Domain_1.default(type) : new Domain_1.default(min, max);
                defName = _pthis.getMockValue(defName);
                _pthis.definitions.push(new Definition_1.default(defName, domain));
                _pthis.cspModel.variables.push(new CSPTools.CSPVar(defName, domain.getRangeOrType()));
            }
        });
    }
    loadPenaltiesAndRewards() {
        var _pthis = this;
        this.guarantees = [];
        this.agreement.terms.guarantees.forEach((g, gi) => {
            var objectives = [];
            g.of.forEach((ofe, ofi) => {
                var penalties = [];
                var rewards = [];
                var declaredProperties = _pthis.notFreeMetrics.map(p => _pthis.getMockValue(p));
                if (!ofe.objective || ofe.objective === "") {
                    throw "Guarantee objective is not defined";
                }
                else {
                    let expr = (this.mock) ? new Expression_1.default(new Expression_1.default(ofe.objective).getMockExpression(this.mockSuffix)) : new Expression_1.default(ofe.objective);
                    if (!expr.validateVariables(declaredProperties)) {
                        throw "All SLO metrics must be defined (" + ofe.objective + ")";
                    }
                }
                if (ofe.penalties) {
                    ofe.penalties.forEach((p, pi) => {
                        var def = _pthis.definitions.filter((d) => d.name === _pthis.getMockValue(Object.keys(p.over)[0]))[0];
                        var arrayValues = [];
                        p.of.forEach((pofi) => {
                            arrayValues.push({
                                value: _pthis.getMockValue(new Expression_1.default(pofi.value)),
                                condition: _pthis.getMockValue(new Expression_1.default(pofi.condition))
                            });
                        });
                        var newPenalty = new Penalty_1.default(_pthis.getMockValue(g.id + "_penalty_" + ofi + "_" + pi), def, arrayValues, _pthis.getMockValue(new Expression_1.default(ofe.objective)));
                        penalties.push(newPenalty);
                        _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                    });
                }
                else {
                    let def = _pthis.getPricingPenalty();
                    let newPenalty = new Penalty_1.default(_pthis.getMockValue(g.id + "_penalty_" + ofi + "_0"), def, [{ value: new Expression_1.default("0"), condition: new Expression_1.default("true") }], _pthis.getMockValue(new Expression_1.default(ofe.objective)));
                    penalties.push(newPenalty);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                }
                if (ofe.rewards) {
                    ofe.rewards.forEach((r, ri) => {
                        var def = _pthis.definitions.filter((d) => d.name === _pthis.getMockValue(Object.keys(r.over)[0]))[0];
                        var arrayValues = [];
                        r.of.forEach((rofi) => {
                            arrayValues.push({
                                value: _pthis.getMockValue(new Expression_1.default(rofi.value)),
                                condition: _pthis.getMockValue(new Expression_1.default(rofi.condition))
                            });
                        });
                        var newReward = new Reward_1.default(_pthis.getMockValue(g.id + "_reward_" + ofi + "_" + ri), def, arrayValues, _pthis.getMockValue(new Expression_1.default(ofe.objective)));
                        rewards.push(newReward);
                        _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                    });
                }
                else {
                    let def = _pthis.getPricingReward();
                    let newReward = new Reward_1.default(_pthis.getMockValue(g.id + "_reward_" + ofi + "_0"), def, [{ value: new Expression_1.default("0"), condition: new Expression_1.default("true") }], _pthis.getMockValue(new Expression_1.default(ofe.objective)));
                    rewards.push(newReward);
                    _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                }
                objectives.push(new Objective_1.default(ofe.objective, penalties, rewards));
            });
            _pthis.guarantees.push(new Guarantee_1.default(g.id, objectives));
        });
    }
    loadConstraints() {
        var _pthis = this;
        var conditionExpressions = [];
        this.agreement.terms.guarantees.forEach(function (g, gi) {
            g.of.forEach(function (of, ofi) {
                var _id = "C" + gi + "_" + ofi;
                if (of.precondition && of.precondition !== "") {
                    conditionExpressions.push("(" + of.precondition + ") -> (" + of.objective + ")");
                }
                else if (of.objective && of.objective !== "") {
                    conditionExpressions.push("(" + of.objective + ")");
                }
                if (of.penalties) {
                    of.penalties.forEach(function (p, pi) {
                        if (p.of) {
                            p.of.forEach(function (ofp, ofpi) {
                                if (ofp.condition && ofp.condition !== "") {
                                    conditionExpressions.push("(" + ofp.condition + ")");
                                }
                            });
                        }
                    });
                }
                if (of.rewards) {
                    of.rewards.forEach(function (r, ri) {
                        if (r.of) {
                            r.of.forEach(function (ofr, ofri) {
                                if (ofr.condition && ofr.condition !== "") {
                                    conditionExpressions.push("(" + ofr.condition + ")");
                                }
                            });
                        }
                    });
                }
            });
        });
        this.cspModel.constraints.push(new CSPTools.CSPConstraint("compensation_exprs", conditionExpressions.join(" \\/ ")));
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
        mockBuilder.guarantees = mockBuilder.guarantees.map((g, gi) => {
            var objectives = g.ofs.map((ofe, ofi) => {
                var penalties = ofe.penalties.map((p) => {
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
                var rewards = ofe.rewards.map((r) => {
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
                return new Objective_1.default(ofe.objective, penalties, rewards);
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
        return this.getDefinitionByName(this.getMockValue(Object.keys(this.agreement.terms.pricing.billing.penalties[0].over)[0]));
    }
    getPricingReward() {
        var rewards = this.agreement.terms.pricing.billing.rewards;
        var def;
        if (!rewards) {
            def = this.getPricingPenalty();
        }
        else {
            def = this.getDefinitionByName(this.getMockValue(Object.keys(this.agreement.terms.pricing.billing.rewards[0].over)[0]));
        }
        return def;
    }
}
exports.default = AgreementCompensationCSPModelBuilder;
