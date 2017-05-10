/*!
governify-agreement-analyzer 0.5.1, built on: 2017-05-10
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
import Guarantee from "../model/Guarantee";
import Objective from "../model/Objective";
import Util from "../util/Util";

const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const CSPVar = CSPTools.CSPVar;
const cspConfig = CSPTools.config;
const cspTypeMap = cspConfig.translator.typeMap;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");
const jsep = require("jsep");

export default class AgreementCompensationCSPModelBuilder {

    metrics: Metric[];
    definitions: Definition[];
    guaranteePenaltyRewardCache: any;
    guarantees: Guarantee[];
    cspModel: typeof CSPModel;
    mock: boolean;

    constructor(private agreement: any, private mockSuffix?: string) {
        if (mockSuffix) {
            this.mock = true;
        }
        this.cspModel = new CSPModel();
        this.guaranteePenaltyRewardCache = {};
        this.loadGuarantees();
    }

    private loadGuarantees(): void {
        this.loadMetrics();
        this.loadDefinitions();
        this.loadPenaltiesAndRewards();
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

    /**
     * Obtain a CSP model for CFC execution.
     */
    buildCFC(): typeof CSPModel {

        var _pthis = this;
        let cfcConstraints: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
            "cfc", this.guarantees.map((g, gi) => _pthis.getCFCExpressionFromGuarantee(g)).join(" \\/ "));

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [cfcConstraints];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    /**
     * Get CFC transformation expression from a Guarantee.
     * @param guarantee Guarantee
     */
    private getCFCExpressionFromGuarantee(guarantee: Guarantee): string {

        var _pthis = this;
        return guarantee.ofs.map((_of: Objective) => _pthis.getCFCExpressionFromObjective(_of)).join(" \\/ ");

    }

    /**
     * Get CFC transformation expression from an Objective.
     * @param guarantee Objective
     */
    private getCFCExpressionFromObjective(_of: Objective): string {

        return "(((" + Penalty.getCFC1(_of.penalties) + ") xor (" + Penalty.getCFC2(_of.penalties) + ")) /\\ ((" +
            Reward.getCFC1(_of.rewards) + ") xor (" + Reward.getCFC2(_of.rewards) + ")))";

    }

    /**
     * Obtain a CSP model for CCC execution.
     */
    buildVFC(): typeof CSPModel {

        var _pthis = this;
        let vfcConstraints: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
            "vfc", this.guarantees.map(g => _pthis.getVFCExpressionFromGuarantee(g)).join(" \\/ "));

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [vfcConstraints];
        cspModel.goal = "satisfy";

        return cspModel;

    }
    private getVFCExpressionFromGuarantee(guarantee: Guarantee): string {

        var _pthis = this;
        return guarantee.ofs.map((_of: Objective) => _pthis.getVFCExpressionFromObjective(_of)).join(" \\/ ");

    }
    private getVFCExpressionFromObjective(_of: Objective): string {

        // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})
        let cfc: string = this.getCFCExpressionFromObjective(_of);

        // (p x r > 0)
        var penalties: string[] = _of.penalties.map(p => p.name);
        var rewards: string[] = _of.rewards.map(r => r.name);
        var constraints: string = "(" + [...penalties, ...rewards].join(" * ") + " > 0)";

        return "(" + cfc + " /\\ " + constraints + ")";

    }

    /**
     * Obtain a CSP model for CCC execution.
     */
    buildCCC(): typeof CSPModel {

        // Create mock builder
        var mockBuilder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement, "2");
        var _pthis = this;

        let cccConstraints: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
            "ccc", this.guarantees.map((g, gi) => _pthis.getCCCExpressionFromGuarantee(mockBuilder, g, gi)).join(" \\/ "));

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = [...this.cspModel.variables, ...mockBuilder.cspModel.variables];
        cspModel.constraints = [...mockBuilder.cspModel.constraints, cccConstraints];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    private getCCCExpressionFromGuarantee(mockBuilder: AgreementCompensationCSPModelBuilder, guarantee: Guarantee, guaranteeIndex: number): string {

        var _pthis = this;
        return guarantee.ofs.map((_of: Objective, _ofi: number) => _pthis.getCCCExpressionFromObjective(mockBuilder, guarantee, guaranteeIndex, _of, _ofi)).join(" \\/ ");

    }

    private getCCCExpressionFromObjective(mockBuilder: AgreementCompensationCSPModelBuilder, guarantee: Guarantee, guaranteeIndex: number, _of: Objective, _ofi: number): string {

        // CFC(m1,p1,r1,{CondP},{AsigP},{CondR},{AsigR})
        let cfc1: string = this.getCFCExpressionFromObjective(_of);

        // CFC(m2,p2,r2,{CondP},{AsigP},{CondR},{AsigR})
        let cfc2: string = mockBuilder.getCFCExpressionFromObjective(mockBuilder.guarantees[guaranteeIndex].ofs[_ofi]);

        // (p1 > p2 OR r1 < r2)
        let penalCompareExpr: string = "(" + _of.penalties.map((p, pi) => {
            return "(" + p.name + " > " + mockBuilder.getMockValue(p.name) + ")";
        }).join(" /\\ ") + ")";
        let rewardCompareExpr: string = "(" + _of.rewards.map((p, pi) => {
            return "(" + p.name + " < " + mockBuilder.getMockValue(p.name) + ")";
        }).join(" /\\ ") + ")";

        // (Utility(m1) > Utility(m2))
        let objectiveExpression: Expression = new Expression(_of.objective);
        let utilityName: string = "ccc_utility_" + [...objectiveExpression.variables].join("") + "_" + _ofi;
        let utility: UtilityFunction = this.getUtilityFunction(utilityName, objectiveExpression);
        let mockUtility: UtilityFunction = mockBuilder.getUtilityFunction(utilityName, objectiveExpression);
        // Declare utility constraint and variable
        mockBuilder.cspModel.variables.push(new CSPVar(utility.var.id, utility.var.range.getRangeOrType()));
        mockBuilder.cspModel.constraints.push(utility.constraint);
        mockBuilder.cspModel.variables.push(new CSPVar(mockUtility.var.id, mockUtility.var.range.getRangeOrType()));
        mockBuilder.cspModel.constraints.push(mockUtility.constraint);

        return "(" + cfc1 + " /\\ " + cfc2 + " /\\ (" + penalCompareExpr + " \\/ " + rewardCompareExpr + ") /\\ (" + utility.var.id + " > " + mockUtility.var.id + "))";
    }

    /**
     * Obtain a CSP model for CSC execution.
     */
    buildCSC(): typeof CSPModel {

        var _pthis = this;
        let cfcConstraints: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
            "csc", this.guarantees.map((g, gi) => _pthis.getCSCExpressionFromGuarantee(g)).join(" \\/ "));

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [cfcConstraints];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    private getCSCExpressionFromGuarantee(guarantee: Guarantee): string {

        var _pthis = this;
        return guarantee.ofs.map((_of: Objective) => _pthis.getCSCExpressionFromObjective(_of)).join(" \\/ ");

    }

    private getCSCExpressionFromObjective(_of: Objective): string {

        // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})
        let cfc: string = this.getCFCExpressionFromObjective(_of);

        // (p = max(domain(p))
        let cscPenalties: string = "(" + _of.penalties.map((p) => {
            return "(" + p.name + " == " + p.over.domain.max + ")";
        }).join(" /\\ ") + ")";

        let cscRewards: string = "(" + _of.rewards.map((r) => {
            return "(" + r.name + " == " + r.over.domain.max + ")";
        }).join(" /\\ ") + ")";

        return "(" + cfc + " /\\ (" + cscPenalties + " \\/ " + cscRewards + "))";

    }

    /**
     * Obtain a CSP model for GCC execution.
     */
    buildGCC(): typeof CSPModel {

        var _pthis = this;
        let cfcConstraints: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
            "gcc", this.guarantees.map((g, gi) => _pthis.getGCCExpressionFromGuarantee(g)).join(" \\/ "));

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [cfcConstraints];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    private getGCCExpressionFromGuarantee(guarantee: Guarantee): string {

        var _pthis = this;
        return guarantee.ofs.map((_of: Objective) => _pthis.getGCCExpressionFromObjective(_of)).join(" \\/ ");

    }

    private getGCCExpressionFromObjective(_of: Objective): string {

        // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})
        let cfc: string = this.getCFCExpressionFromObjective(_of);

        // (p = max(domain(p))
        let gccPenalties: string = "(" + _of.penalties.map((p) => {
            return "(" + p.name + " > 0 /\\ (" + p.objective.expr + "))";
        }).join(" /\\ ") + ")";

        let gccRewards: string = "(" + _of.rewards.map((r) => {
            return "(" + r.name + " > 0 /\\ not (" + r.objective.expr + "))";
        }).join(" /\\ ") + ")";

        return "(" + cfc + " /\\ (" + gccPenalties + " \\/ " + gccRewards + "))";

    }

    /**
     * Obtain a CSP model for OBT.
     */
    buildOGT(): typeof CSPModel {

        return this.buildOptimalThreshold("OGT", "minimize");

    }

    /**
     * Obtain a CSP model for OBT.
     */
    buildOBT(): typeof CSPModel {

        return this.buildOptimalThreshold("OBT", "maximize");

    }

    /**
     * Obtain a CSP model for OGT or OBT execution.
     * @param solveType "minimize" or "maximize" for OGT or OBT
     */
    private buildOptimalThreshold(operationName: string, solveType: string): typeof CSPModel {

        var _pthis = this;

        operationName = operationName.toLowerCase();

        // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})
        let cfc: typeof CSPModel = this.buildCFC();

        let constraints: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
            operationName, this.guarantees.map((g) => _pthis.getOptimalThresholdFromGuarantee(g, operationName)).join(" \\/ "));

        let utility: UtilityFunction = this.loadAggregatedUtilityFunction();

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = [...this.cspModel.constraints, constraints];

        // Get first metric to minimize
        if (this.metrics.length === 0) {
            throw "Unable to find any metric to minimize or maximize";
        } else {
            cspModel.goal = solveType + " " + utility.var.id;
        }

        return cspModel;

    }

    /**
     * Loads the utility function variable and constraint statements and returns a UtilityFunction object.
     */
    private loadAggregatedUtilityFunction(): UtilityFunction {

        var _pthis = this;

        // Store all utility function constraints for each "objective" inside of each guarantee
        let aggregatedUtilityFunction: string = "(" + this.guarantees.map((g, gi) => {
            // Obtain objectives
            return "(" + g.ofs.map((_of, _ofi) => {
                let utility: UtilityFunction = _pthis.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression(_of.objective));
                _pthis.cspModel.variables.push(new CSPVar(utility.var.id, utility.var.range.getRangeOrType()));
                _pthis.cspModel.constraints.push(utility.constraint);
                return utility.var.id;
            }).join(" + ") + ")";

            // if (aggregatedObjectives.length > 1) {
            //     let utility: UtilityFunction = {};
            //     utility.var = new CSPTools.CSPVar("ccc_utility" + gi, new Domain(0, 1).getRangeOrType());
            //     utility.constraint = new CSPTools.CSPConstraint("ccc_utility" + gi, aggregatedObjectives);
            //     _pthis.cspModel.variables.push(utility.var);
            //     _pthis.cspModel.constraints.push(utility.constraint);
            // }

            // return utility.var.id;
        }).join(" + ") + ")";

        let utility: UtilityFunction = {};
        utility.var = new CSPTools.CSPVar("ccc_aggregated_utility", "int");
        utility.constraint = new CSPTools.CSPConstraint("ccc_aggregated_utility", utility.var.id + " == " + aggregatedUtilityFunction);
        this.cspModel.variables.push(new CSPVar(utility.var.id, utility.var.type));
        this.cspModel.constraints.push(utility.constraint);

        return utility;

    }

    private getOptimalThresholdFromGuarantee(guarantee: Guarantee, operationName: string): string {

        var _pthis = this;
        return guarantee.ofs.map((_of: Objective) => _pthis.getOptimalThresholdFromObjective(_of, operationName)).join(" \\/ ");

    }

    private getOptimalThresholdFromObjective(_of: Objective, operationName: string): string {

        // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})
        let cfc: string = this.getCFCExpressionFromObjective(_of);

        // p = 0 or r = 0
        var constraints: string = "";
        if (operationName === "ogt") {
            constraints = "(" + _of.penalties.map((p) => {
                return "(" + p.name + " == 0)";
            }).join(" /\\ ") + ")";
        } else if (operationName === "obt") {
            constraints = "(" + _of.rewards.map((r) => {
                return "(" + r.name + " == 0)";
            }).join(" /\\ ") + ")";
        } else {
            throw new Error("Agreement compensation internal error, operation type should be set \"OGT\" or \"OBT\"");
        }

        return "(" + cfc + " /\\ " + constraints + ")";

    }

    /**
     * Obtain an utility function from a guarantee objective expression and considering which kind of expression it is.
     * @param name Name of utility function
     * @param expression Guarantee objective expression
     */
    private getUtilityFunction(name: string, expression: Expression): UtilityFunction {

        name = this.getMockValue(name);
        expression = this.getMockValue(expression);

        var utility: UtilityFunction = {};
        var variables = expression.variables;

        // Decide which utility function to define
        // if (variables.size > 1 || (variables.size == 1 && !expression.expr.match(/[<>]/))) {
        // utility.var = new CSPTools.CSPVar(name, new CSPTools.CSPRange(0, 1));
        // utility.constraint = new CSPTools.CSPConstraint(utility.var.id,
        //     "(" + utility.var.id + " == 1 /\\ (" + expression.expr + ")) xor (" +
        //     utility.var.id + " == 0 /\\ not (" + expression.expr + "))");
        // } else {
        // There is only a number variable in objective expression
        var expressionVar: string = [...variables][0];
        let metricUtil: Metric = this.getMetricByName(expressionVar);
        utility.var = new CSPTools.CSPVar(name, new Domain("-" + metricUtil.domain.getRangeOrType().max, metricUtil.domain.getRangeOrType().max));
        // Set expression signal
        var parserTree = jsep(expression.expr);
        if (parserTree.type === "BinaryExpression") {
            if (parserTree.left.type === "Identifier") {
                if (parserTree.operator === "<" || parserTree.operator === "<=") {
                    expressionVar = "-" + expressionVar;
                }
            } else {
                if (parserTree.operator === ">" || parserTree.operator === ">=") {
                    expressionVar = "-" + expressionVar;
                }
            }

        }
        utility.constraint = new CSPTools.CSPConstraint(utility.var.id, name + " == " + expressionVar);
        // }

        return utility;

    }

    private getMockValue(v: any) {
        if (typeof v === "string") {
            return this.mock ? v + this.mockSuffix : v;
        } else {
            let expr: Expression = v;
            return this.mock ? new Expression(expr.getMockExpression(this.mockSuffix)) : v;
        }
    }

    private loadMetrics(): void {

        let metricNames = Object.keys(this.agreement.terms.metrics);
        this.metrics = [];
        var _pthis = this;

        metricNames.forEach((metricName) => {

            var type: string = _pthis.agreement.terms.metrics[metricName].schema.type;

            let _min: number = _pthis.agreement.terms.metrics[metricName].schema.minimum;
            let _max: number = _pthis.agreement.terms.metrics[metricName].schema.maximum;
            var min: string;
            var max: string;

            if (cspTypeMap[type] === "float") {
                min = Util.toStringFloat(_min);
                max = Util.toStringFloat(_max);
            } else {
                min = _min.toString();
                max = _max.toString();
            }

            var domain: Domain = (isNaN(Number(min)) || isNaN(Number(max))) ? new Domain(type) : new Domain(min, max);

            metricName = _pthis.getMockValue(metricName);
            _pthis.metrics.push(new Metric(metricName, domain)); // _pthis.agreement.terms.metrics[metricName].schema.type
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(metricName, domain.getRangeOrType()));

        });

    }

    private loadDefinitions(): void {

        let definitionNames = Object.keys(this.agreement.context.definitions.schemas);
        this.definitions = [];
        var _pthis = this;

        definitionNames.forEach((defName) => {

            var type: string = _pthis.agreement.context.definitions.schemas[defName].type;

            let _min: number = _pthis.agreement.context.definitions.schemas[defName].minimum;
            let _max: number = _pthis.agreement.context.definitions.schemas[defName].maximum;
            var min: string;
            var max: string;

            if (cspTypeMap[type] === "float") {
                min = Util.toStringFloat(_min);
                max = Util.toStringFloat(_max);
            } else {
                min = _min.toString();
                max = _max.toString();
            }

            var domain: Domain = (isNaN(Number(min)) || isNaN(Number(max))) ? new Domain(type) : new Domain(min, max);

            defName = _pthis.getMockValue(defName);
            _pthis.definitions.push(new Definition(defName, domain)); // _pthis.agreement.terms.metrics[metricName].schema.type
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(defName, domain.getRangeOrType()));

        });

    }

    // private addPenaltyToCache(guarantee: Guarantee, penalty: Penalty): void {
    //     var _id: string = guarantee.id;
    //     if (!(_id in this.guaranteePenaltyRewardCache)) {
    //         this.guaranteePenaltyRewardCache[_id] = { penalties: [], rewards: [] };
    //     }
    //     this.guaranteePenaltyRewardCache[_id].penalties.push(penalty.name);
    // }

    // private addRewardToCache(guarantee: Guarantee, reward: Reward): void {
    //     var _id: string = guarantee.id;
    //     if (!(_id in this.guaranteePenaltyRewardCache)) {
    //         this.guaranteePenaltyRewardCache[_id] = { penalties: [], rewards: [] };
    //     }
    //     this.guaranteePenaltyRewardCache[_id].rewards.push(reward.name);
    // }

    private loadPenaltiesAndRewards(): void {

        var _pthis = this;
        this.guarantees = [];

        this.agreement.terms.guarantees.forEach((g) => {

            var objectives: Objective[] = [];

            g.of.forEach((ofi) => {

                var penalties = [];
                var rewards = [];

                if (ofi.penalties) {
                    ofi.penalties.forEach((p, pi) => {
                        // Get definition name from object key
                        var def: Definition = _pthis.definitions.filter((d) => d.name === _pthis.getMockValue(Object.keys(p.over)[0]))[0];
                        // Consider multiple "of"s in a penalty
                        var penalCondition: string = "";
                        var arrayValues: ValueCondition[] = [];
                        p.of.forEach((pofi) => {
                            arrayValues.push({
                                value: pofi.value,
                                condition: _pthis.getMockValue(new Expression(pofi.condition))
                            });
                        });
                        var newPenalty: Penalty = new Penalty(_pthis.getMockValue(g.id + "_penalty" + pi), def, arrayValues, _pthis.getMockValue(new Expression(ofi.objective)));
                        penalties.push(newPenalty);
                        // _pthis.addPenaltyToCache(g, newPenalty);
                        _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                    });
                } else {
                    let def = _pthis.getPricingPenalty();
                    let newPenalty: Penalty = new Penalty(_pthis.getMockValue(g.id + "_penalty0"), def, [{ value: 0, condition: new Expression("true") }],
                        _pthis.getMockValue(new Expression(ofi.objective))
                    );
                    penalties.push(newPenalty);
                    _pthis.cspModel.variables.push(
                        new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType())
                    );
                }

                if (ofi.rewards) {
                    ofi.rewards.forEach((r, ri) => {
                        var def = _pthis.definitions.filter((d) => d.name === _pthis.getMockValue(Object.keys(r.over)[0]))[0]; // only considers the first "over"
                        // Consider multiple "of"s in a reward
                        var penalCondition: string = "";
                        var arrayValues: ValueCondition[] = [];
                        r.of.forEach((rofi) => {
                            arrayValues.push({
                                value: rofi.value,
                                condition: _pthis.getMockValue(new Expression(rofi.condition))
                            });
                        });
                        var newReward: Reward = new Reward(_pthis.getMockValue(g.id + "_reward" + ri), def, arrayValues, _pthis.getMockValue(new Expression(ofi.objective)));
                        rewards.push(newReward);
                        // _pthis.addRewardToCache(g, newReward);
                        _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                    });
                } else {
                    let def = _pthis.getPricingReward();
                    let newReward: Reward = new Reward(
                        _pthis.getMockValue(g.id + "_reward0"), def,
                        [{ value: 0, condition: new Expression("true") }],
                        _pthis.getMockValue(new Expression(ofi.objective))
                    );
                    rewards.push(newReward);
                    _pthis.cspModel.variables.push(
                        new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType())
                    );
                }

                objectives.push(new Objective(ofi.objective, penalties, rewards));

            });

            _pthis.guarantees.push(new Guarantee(g.id, objectives));

        });
    }

    private loadConstraints(): void {
        var _pthis = this;
        var conditionExpressions = [];
        this.agreement.terms.guarantees.forEach(function (g: any, gi: number) {
            g.of.forEach(function (of: any, ofi: number) {

                var _id: string = "C" + gi + "_" + ofi;

                if (of.precondition && of.precondition !== "") {
                    // Use "precondition->objective" to define constraint
                    conditionExpressions.push("(" + of.precondition + ") -> (" + of.objective + ")");
                } else if (of.objective && of.objective !== "") {
                    // Use "objective" property to define constraint
                    conditionExpressions.push("(" + of.objective + ")");
                }

                // Add penalty expressions as contraints
                if (of.penalties) {
                    of.penalties.forEach(function (p: any, pi: number) {
                        if (p.of) {
                            p.of.forEach(function (ofp: any, ofpi: number) {
                                if (ofp.condition && ofp.condition !== "") {
                                    conditionExpressions.push("(" + ofp.condition + ")");
                                }
                            });
                        }
                    });
                }

                // Add reward expressions as contraints
                if (of.rewards) {
                    of.rewards.forEach(function (r: any, ri: number) {
                        if (r.of) {
                            r.of.forEach(function (ofr: any, ofri: number) {
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

    private getMockInstance(mockSuffix: string): AgreementCompensationCSPModelBuilder {

        var mockBuilder: AgreementCompensationCSPModelBuilder = new AgreementCompensationCSPModelBuilder(this.agreement);

        mockBuilder.definitions = mockBuilder.definitions.map((def) => {
            def.name = def.name + mockSuffix;
            return def;
        });

        mockBuilder.metrics = mockBuilder.metrics.map((met) => {
            met.name = met.name + mockSuffix;
            return met;
        });

        mockBuilder.guarantees = mockBuilder.guarantees.map((g) => {

            var objectives: Objective[] = g.ofs.map((ofi) => {

                var penalties: Penalty[] = ofi.penalties.map((p) => {

                    if (!mockBuilder.existVariable(p.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(p.name, p.over.domain.getRangeOrType()));
                    }
                    if (!mockBuilder.existVariable(p.name + mockSuffix)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(p.name + mockSuffix, p.over.domain.getRangeOrType()));
                    }
                    // Declare penalty variable only if is a different text
                    p.valueCondition.forEach((vc: ValueCondition, index: number) => {
                        vc.condition.expr = vc.condition.getMockExpression(mockSuffix);
                        vc.condition.variables.forEach((v) => {
                            if (!mockBuilder.existVariable(v + mockSuffix)) {
                                let met: Metric = mockBuilder.getMetricByName(v + mockSuffix);
                                mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                            }
                        });
                    });

                    return p;

                });

                var rewards: Reward[] = ofi.rewards.map((r) => {

                    if (!mockBuilder.existVariable(r.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(r.name, r.over.domain.getRangeOrType()));
                    }
                    if (!mockBuilder.existVariable(r.name + mockSuffix)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(r.name + mockSuffix, r.over.domain.getRangeOrType()));
                    }
                    // Declare penalty variable only if is a different text
                    r.valueCondition.forEach((vc: ValueCondition, index: number) => {
                        vc.condition.expr = vc.condition.getMockExpression(mockSuffix);
                        vc.condition.variables.forEach((v) => {
                            if (!mockBuilder.existVariable(v + mockSuffix)) {
                                let met: Metric = mockBuilder.getMetricByName(v + mockSuffix);
                                mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                            }
                        });
                    });

                    return r;

                });

                return new Objective(ofi.objective, penalties, rewards);

            });

            return new Guarantee(g.id, objectives);

        });

        return mockBuilder;
    }

    private existVariable(name: string): boolean {
        return this.cspModel.variables.filter((_v) => _v.id === name).length > 0;
    }

    /**
     * Tries to obtain definition by name.
     * @param name Definition name
     */
    private getDefinitionByName(name: string): Definition {
        var ret: Definition;
        let defs: Definition[] = this.definitions.filter((d) => name === d.name);
        if (defs.length > 0) {
            ret = defs[0];
        }
        return ret;
    }

    /**
     * Tries to obtain definition by name.
     * @param name Definition name
     */
    private getMetricByName(name: string): Metric {
        var ret: Metric;
        let mets: Metric[] = this.metrics.filter((d) => name === d.name);
        if (mets.length > 0) {
            ret = mets[0];
        }
        return ret;
    }

    private getPricingPenalty(): Definition {
        return this.getDefinitionByName(this.getMockValue(Object.keys(this.agreement.terms.pricing.billing.penalties[0].over)[0]));
    }

    private getPricingReward(): Definition {
        var rewards: any[] = this.agreement.terms.pricing.billing.rewards;
        var def: Definition;
        if (!rewards) {
            def = this.getPricingPenalty();
        } else {
            def = this.getDefinitionByName(this.getMockValue(Object.keys(this.agreement.terms.pricing.billing.rewards[0].over)[0]));
        }
        return def;
    }

}

interface UtilityFunction {
    var?: typeof CSPTools.CSPVar;
    constraint?: typeof CSPTools.CSPConstraint;
}

interface ValueCondition {
    value?: number;
    condition?: Expression;
}