/*!
governify-agreement-analyzer 0.1.1, built on: 2017-03-27
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

const CSPTools = require("governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const cspConfig = CSPTools.config;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");
const jsep = require("jsep");

export default class AgreementCompensationCSPModelBuilder {

    metrics: Metric[];
    definitions: Definition[];
    guaranteePenaltyRewardCache: any;
    guarantees: Guarantee[];
    cspModel: typeof CSPModel;

    constructor(private agreement: any) {
        this.cspModel = new CSPModel();
        this.guaranteePenaltyRewardCache = {};
        this.loadGuarantees();
    }

    private loadGuarantees(): void {
        this.loadMetrics();
        this.loadDefinitions();
        this.loadPenaltiesAndRewards();
        this.equalizePenaltyReward();
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

        let cfcConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            var expr: string = "";
            g.ofs.forEach((_of) => {
                if (expr !== "") {
                    expr += " /\\ ";
                }
                expr += "((" + Penalty.getCFC1(_of.penalties) + " xor " + Penalty.getCFC2(_of.penalties) + ") /\\ (" +
                    Reward.getCFC1(_of.rewards) + " xor " + Reward.getCFC2(_of.rewards) + "))";
            });
            return new CSPTools.CSPConstraint("cfc_" + g.id + gi, expr);
        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfcConstraints;
        cspModel.goal = "satisfy";

        return cspModel;

    }

    /**
     * Obtain a CSP model for CCC execution.
     */
    buildCCC(): typeof CSPModel {

        // Create mock builder
        let mockSuffix: string = "2";
        var mockBuilder: AgreementCompensationCSPModelBuilder = this.getMockInstance(mockSuffix);
        var _pthis = this;

        let cccConstraints1: typeof CSPTools.CSPConstraint[] = this.buildCFC().constraints; // CFC(m1,p1,r1,{CondP},{AsigP},{CondR},{AsigR})
        let cccConstraints2: typeof CSPTools.CSPConstraint[] = mockBuilder.buildCFC().constraints; // CFC(m2,p2,r2,{CondP},{AsigP},{CondR},{AsigR})
        let cccConstraints3: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {

            var expr: string = "";

            g.ofs.forEach((_of, _ofi) => {

                let penalCompareExpr: string = _of.penalties.map((p, pi) => {
                    return "(" + p.name + " > " + mockBuilder.guarantees[gi].ofs[_ofi].penalties[pi].name + ")";
                }).join(" /\\ ");

                let rewardCompareExpr: string = _of.rewards.map((p, pi) => {
                    return "(" + p.name + " < " + mockBuilder.guarantees[gi].ofs[_ofi].rewards[pi].name + ")";
                }).join(" /\\ ");

                // let penalRewardProductExpr: string = "not (" + _pthis.guaranteePenaltyRewardCache[g.id].penalties
                //     .concat(_pthis.guaranteePenaltyRewardCache[g.id].rewards)
                //     .join(" * ") + " == 0)";

                if (expr !== "") {
                    expr += " /\\ ";
                }

                // expr += "(" + penalCompareExpr + " \\/ " + rewardCompareExpr + " \\/ " + penalRewardProductExpr + ")";
                expr += "(" + penalCompareExpr + " \\/ " + rewardCompareExpr + ")";

            });

            return new CSPTools.CSPConstraint("ccc_3", expr);

        });

        // Store all utility function constraints for each "objective" inside a guarantee
        let cccConstraints4 = this.guarantees.map((g, gi) => {
            return g.ofs.map((_of, _ofi) => {

                // Create utility variables
                let utility: UtilityFunction = _pthis.getUtilityFunction(
                    "ccc_objectives_utility" + gi + _ofi, new Expression(_of.objective));
                let mockUtility: UtilityFunction = mockBuilder.getUtilityFunction(
                    "ccc_objectives_utility" + gi + _ofi,
                    new Expression(new Expression(_of.objective).getMockExpression(mockSuffix)));

                // Declare mock constraint and variables
                mockUtility.var.id = utility.var.id + mockSuffix;
                let expression: Expression = new Expression(utility.constraint.expression);
                // expression.variables = new Set([...expression.variables].map((_v) => {
                //     _pthis.cspModel.variables.push(_v + mockSuffix);
                //     return _v + mockSuffix;
                // }));
                mockUtility.constraint.expression = expression.getMockExpression(mockSuffix);

                // _pthis.cspModel.variables.push(utility.var);
                // _pthis.cspModel.constraints.push(utility.constraint);
                mockBuilder.cspModel.variables.push(utility.var);
                mockBuilder.cspModel.constraints.push(utility.constraint);
                mockBuilder.cspModel.variables.push(mockUtility.var);
                mockBuilder.cspModel.constraints.push(mockUtility.constraint);

                return utility.var.id + " > " + mockUtility.var.id;

            });

        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = mockBuilder.cspModel.variables;
        cspModel.constraints = [...mockBuilder.cspModel.constraints, ...cccConstraints1.map((c, ci) => {
            return new CSPTools.CSPConstraint("ccc_" + ci,
                c.expression + " /\\ " +
                cccConstraints2[ci].expression + " /\\ " +
                cccConstraints3[ci].expression + " /\\ " +
                // Get all constraints for this index
                cccConstraints4[ci].join(" /\\ "));
        })];
        cspModel.goal = "satisfy";

        return cspModel;

    }

    /**
     * Obtain a CSP model for CSC execution.
     */
    buildCSC(): typeof CSPModel {

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

        let cscPenaltyConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("csc", g.ofs.map((_of, _ofi) => {
                return _of.penalties.map((p) => {
                    return "(" + p.name + " == " + p.over.domain.max + ")";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });

        let cscRewardConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("csc", g.ofs.map((_of, _ofi) => {
                return _of.rewards.map((r) => {
                    return "(" + r.name + " == " + r.over.domain.max + ")";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("csc", "(" + c.expression + ") /\\ ((" +
                cscPenaltyConstraints[ci].expression + ") \\/ (" + cscRewardConstraints[ci].expression + "))");
        });
        cspModel.goal = "satisfy";

        return cspModel;

    }

    /**
     * Obtain a CSP model for GCC execution.
     */
    buildGCC(): typeof CSPModel {

        let cfc = this.buildCFC();

        let gccPenaltyConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("gcc", g.ofs.map((_of, _ofi) => {
                return _of.penalties.map((p) => {
                    return "(" + p.name + " > 0 /\\ (" + p.objective.expr + "))";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });

        let gccRewardConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("gcc", g.ofs.map((_of, _ofi) => {
                return _of.rewards.map((r) => {
                    return "(" + r.name + " > 0 /\\ not (" + r.objective.expr + "))";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("gcc_" + ci, "(" + c.expression + ") /\\ (" +
                gccPenaltyConstraints[ci].expression + ") /\\ (" + gccRewardConstraints[ci].expression + ")");
        });
        cspModel.goal = "satisfy";

        return cspModel;

    }

    /**
     * Obtain a CSP model for OBT.
     */
    buildOGT(): typeof CSPModel {

        return this.buildOptimalThreshold("minimize");

    }

    /**
     * Obtain a CSP model for OBT.
     */
    buildOBT(): typeof CSPModel {

        return this.buildOptimalThreshold("maximize");

    }

    /**
     * Loads the utility function variable and constraint statements and returns a UtilityFunction object.
     */
    private loadUtilityFunction(): UtilityFunction {

        var _pthis = this;

        // Store all utility function constraints for each "objective" inside of each guarantee
        let aggregatedUtilityFunction: string = "(" + this.guarantees.map((g, gi) => {
            // Obtain objectives 
            return "(" + g.ofs.map((_of, _ofi) => {
                let utility: UtilityFunction = _pthis.getUtilityFunction("ccc_objectives_utility" + gi + _ofi, new Expression(_of.objective));
                _pthis.cspModel.variables.push(utility.var);
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
        utility.var = new CSPTools.CSPVar("ccc_aggregated_utility", new Domain(0, 1).getRangeOrType());
        utility.constraint = new CSPTools.CSPConstraint("ccc_aggregated_utility", utility.var.id + " == " + aggregatedUtilityFunction);
        this.cspModel.variables.push(utility.var);
        this.cspModel.constraints.push(utility.constraint);

        return utility;
    }

    /**
     * Obtain a CSP model for OGT or OBT execution.
     * @param solveType "minimize" or "maximize" for OGT or OBT
     */
    private buildOptimalThreshold(solveType: string): typeof CSPModel {

        var _pthis = this;

        let utility: UtilityFunction = this.loadUtilityFunction();
        let cfc: typeof CSPModel = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

        let ogtPenaltyConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("ogt", g.ofs.map((_of, _ofi) => {
                return _of.penalties.map((p) => {
                    return "(" + p.name + " == 0)";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });

        let ogtRewardConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            return new CSPTools.CSPConstraint("ogt", g.ofs.map((_of, _ofi) => {
                return _of.rewards.map((r) => {
                    return "(" + r.name + " == 0)";
                }).join(" /\\ ");
            }).join(" /\\ "));
        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;

        cspModel.constraints = this.cspModel.constraints.concat(cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("ogt_" + ci, "(" + c.expression + ") /\\ (" +
                ogtPenaltyConstraints[ci].expression + ") /\\ (" + ogtRewardConstraints[ci].expression + ")");
        }));

        // Get first metric to minimize
        if (this.metrics.length === 0) {
            throw "Unable to find a metric to minimize";
        } else {
            cspModel.goal = solveType + " " + utility.var.id;
        }

        return cspModel;

    }

    /**
     * Obtain an utility function from a guarantee objective expression and considering which kind of expression it is.
     * @param name Name of utility function
     * @param expression Guarantee objective expression
     */
    private getUtilityFunction(name: string, expression: Expression): UtilityFunction {

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
        utility.var = new CSPTools.CSPVar(name, new Domain("-" + metricUtil.domain.max, metricUtil.domain.max));
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

    private loadMetrics(): void {

        let metricNames = Object.keys(this.agreement.terms.metrics);
        this.metrics = [];
        var _pthis = this;

        metricNames.forEach((metricName) => {

            var min: number = _pthis.agreement.terms.metrics[metricName].schema.minimum;
            var max: number = _pthis.agreement.terms.metrics[metricName].schema.maximum;
            var type: string = _pthis.agreement.terms.metrics[metricName].schema.type;
            var domain: Domain = (isNaN(min) || isNaN(max)) ? new Domain(type) : new Domain(min, max);

            _pthis.metrics.push(new Metric(metricName, domain)); // _pthis.agreement.terms.metrics[metricName].schema.type
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(metricName, domain.getRangeOrType()));

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
            var domain: Domain = (isNaN(min) || isNaN(max)) ? new Domain(type) : new Domain(min, max);

            _pthis.definitions.push(new Definition(defName, domain)); // _pthis.agreement.terms.metrics[metricName].schema.type
            _pthis.cspModel.variables.push(new CSPTools.CSPVar(defName, domain.getRangeOrType()));

        });

    }

    private addPenaltyToCache(guarantee: Guarantee, penalty: Penalty): void {
        var _id: string = guarantee.id;
        if (!(_id in this.guaranteePenaltyRewardCache)) {
            this.guaranteePenaltyRewardCache[_id] = { penalties: [], rewards: [] };
        }
        this.guaranteePenaltyRewardCache[_id].penalties.push(penalty.name);
    }

    private addRewardToCache(guarantee: Guarantee, reward: Reward): void {
        var _id: string = guarantee.id;
        if (!(_id in this.guaranteePenaltyRewardCache)) {
            this.guaranteePenaltyRewardCache[_id] = { penalties: [], rewards: [] };
        }
        this.guaranteePenaltyRewardCache[_id].rewards.push(reward.name);
    }

    private loadPenaltiesAndRewards(): void {

        var _pthis = this;
        this.guarantees = [];

        this.agreement.terms.guarantees.forEach((g) => {

            var objectives: Objective[] = [];

            g.of.forEach((ofi) => {

                var penalties = [];
                var rewards = [];

                if (ofi.penalties) {
                    ofi.penalties.forEach((p, index) => {
                        var def = _pthis.definitions.filter((d) => d.name === Object.keys(p.over)[0])[0]; // only considers the first "over"
                        // Consider multiple "of"s in a penalty
                        p.of.forEach((pofi, ofindex) => {
                            var newPenalty = new Penalty(g.id + index + ofindex, def, pofi.value,
                                new Expression(pofi.condition), new Expression(ofi.objective)
                            );
                            penalties.push(newPenalty);
                            _pthis.addPenaltyToCache(g, newPenalty);
                            _pthis.cspModel.variables.push(new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType()));
                        });
                    });
                }

                if (ofi.rewards) {
                    ofi.rewards.forEach((r, index) => {
                        var def = _pthis.definitions.filter((d) => d.name === Object.keys(r.over)[0])[0]; // only considers the first "over"
                        // Consider multiple "of"s in a reward
                        r.of.forEach((rofi, ofindex) => {
                            var newReward = new Reward(g.id + index + ofindex, def, rofi.value,
                                new Expression(rofi.condition), new Expression(ofi.objective)
                            );
                            rewards.push(newReward);
                            _pthis.addRewardToCache(g, newReward);
                            _pthis.cspModel.variables.push(new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType()));
                        });
                    });
                }

                objectives.push(new Objective(ofi.objective, penalties, rewards));

            });

            _pthis.guarantees.push(new Guarantee(g.id, objectives));

        });
    }

    /**
     * Equalize the number of penalties and rewards with 0
     */
    private equalizePenaltyReward(): void {

        var _pthis = this;

        this.guarantees.forEach((g, gi) => {
            g.ofs.forEach((_of, _ofi) => {

                if (_of.penalties.length === 0) {

                    let def = _pthis.getPricingPenalty();
                    let newPenalty: Penalty = new Penalty(g.id + gi + _ofi, def, 0,
                        new Expression("true"),
                        new Expression(_of.objective)
                    );

                    _of.penalties.push(newPenalty);
                    _pthis.cspModel.variables.push(
                        new CSPTools.CSPVar(newPenalty.name, def.domain.getRangeOrType())
                    );

                }

                if (_of.rewards.length === 0) {

                    let def = _pthis.getPricingReward();
                    let newReward: Reward = new Reward(g.id + gi + _ofi, def, 0,
                        new Expression("true"),
                        new Expression(_of.objective)
                    );

                    _of.rewards.push(newReward);
                    _pthis.cspModel.variables.push(
                        new CSPTools.CSPVar(newReward.name, def.domain.getRangeOrType())
                    );

                }

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
            var objectives: Objective[] = [];
            g.ofs.forEach((ofi) => {

                var penalties: Penalty[] = ofi.penalties.map((p) => {
                    if (!mockBuilder.existVariable(p.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(p.name, p.over.domain.getRangeOrType()));
                    }
                    // Declare penalty variable only if is a different text
                    p.condition.expr = p.condition.getMockExpression(mockSuffix);
                    p.condition.variables.forEach((v) => {
                        if (!mockBuilder.existVariable(v + mockSuffix)) {
                            let met: Metric = mockBuilder.getMetricByName(v + mockSuffix);
                            mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                        }
                    });
                    return p;
                });

                var rewards: Reward[] = ofi.rewards.map((r) => {
                    if (!mockBuilder.existVariable(r.name)) {
                        mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(r.name, r.over.domain.getRangeOrType()));
                    }
                    // Declare reward variable only if is a different text
                    r.condition.expr = r.condition.getMockExpression(mockSuffix);
                    r.condition.variables.forEach((v) => {
                        if (!mockBuilder.existVariable(v + mockSuffix)) {
                            let met: Metric = mockBuilder.getMetricByName(v + mockSuffix);
                            mockBuilder.cspModel.variables.push(new CSPTools.CSPVar(v + mockSuffix, met.domain.getRangeOrType()));
                        }
                    });
                    return r;
                });

                objectives.push(new Objective(ofi.objective, penalties, rewards));

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
        return this.getDefinitionByName(Object.keys(this.agreement.terms.pricing.billing.penalties[0].over)[0]);
    }

    private getPricingReward(): Definition {
        var rewards: any[] = this.agreement.terms.pricing.billing.rewards;
        var def: Definition;
        if (!rewards) {
            def = this.getPricingPenalty();
        } else {
            def = this.getDefinitionByName(Object.keys(this.agreement.terms.pricing.billing.rewards[0].over)[0]);
        }
        return def;
    }

}

interface UtilityFunction {
    var?: typeof CSPTools.CSPVar;
    constraint?: typeof CSPTools.CSPConstraint;
}