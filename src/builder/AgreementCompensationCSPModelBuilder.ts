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


import Metric from "../model/Metric";
import Penalty from "../model/Penalty";
import Reward from "../model/Reward";
import Definition from "../model/Definition";
import Expression from "../model/Expression";
import Domain from "../model/Domain";
import Guarantee from "../model/Guarantee";
import Objective from "../model/Objective";

const CSPTools = require("E:\\Documents\\Coding\\CSP\\governify-csp-tools");
const CSPModel = CSPTools.CSPModel;
const cspConfig = CSPTools.config;
const minMaxMap = require("../configurations/config").minMaxMap;
const logger = require("../logger/logger");

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

    buildCFC(): typeof CSPModel {

        let cfcConstraints: typeof CSPTools.CSPConstraint[] = this.guarantees.map((g, gi) => {
            var expr: string = "";
            g.ofs.forEach((_of) => {
                if (expr !== "") {
                    expr += " \\/ ";
                }
                expr += "(" + Penalty.getCFC1(_of.penalties) + " xor " + Reward.getCFC1(_of.rewards) + " xor " +
                    Penalty.getCFC2(_of.penalties) + " xor " + Reward.getCFC2(_of.rewards) + ")";
            });
            return new CSPTools.CSPConstraint("cfc_" + g.id + gi, expr);
        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = this.cspModel.variables;
        cspModel.constraints = cfcConstraints;
        cspModel.goal = "satisfy";

        return cspModel;

    }

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

                let penalRewardProductExpr: string = "not (" + _pthis.guaranteePenaltyRewardCache[g.id].penalties
                    .concat(_pthis.guaranteePenaltyRewardCache[g.id].rewards)
                    .join(" * ") + " == 0)";

                if (expr !== "") {
                    expr += " \\/ ";
                }

                expr += "(" + penalCompareExpr + " \\/ " + rewardCompareExpr + " \\/ " + penalRewardProductExpr + ")";

            });

            return new CSPTools.CSPConstraint("ccc_3", expr);

        });

        // Store all utility function constraints for each "objective" inside a guarantee
        var cccConstraints4: typeof CSPTools.CSPConstraint[][] = this.guarantees.map((g, gi) => {
            // Store it by using guarantee index
            return g.ofs.map((_of, _ofi) => {
                //TODO: check which kind of utility function to use.
                // Create utility variables
                let var1: typeof CSPTools.CSPVar = new CSPTools.CSPVar("ccc_utility_" + gi + _ofi + "1", new CSPTools.CSPRange(0, 1));
                let var2: typeof CSPTools.CSPVar = new CSPTools.CSPVar("ccc_utility_" + gi + _ofi + "2", new CSPTools.CSPRange(0, 1));
                // Create utility functions
                let constraint1: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
                    var1.id, "(" + var1.id + " == 1 /\\ (" + _of.objective + ")) xor (" +
                    var1.id + " == 0 /\\ not (" + _of.objective + "))");
                let constraint2: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
                    var2.id, "(" + var2.id + " == 1 /\\ (" + _of.objective + ")) xor (" +
                    var2.id + " == 0 /\\ not (" + new Expression(_of.objective).getMockExpression(mockSuffix) + "))");
                // Update model with new variables
                mockBuilder.cspModel.variables.push(var1, var2);
                // Store utility functions for each objective
                return new CSPTools.CSPConstraint("ccc_utility" + gi + _ofi, "(" + constraint1.expression + " /\\ " + constraint2.expression + ")");
            });
        });

        let cspModel: typeof CSPModel = new CSPModel();
        cspModel.variables = mockBuilder.cspModel.variables;
        cspModel.constraints = cccConstraints1.map((c, ci) => {
            return new CSPTools.CSPConstraint("ccc_" + ci, c.expression + " /\\ " +
                cccConstraints2[ci].expression + " /\\ " +
                cccConstraints3[ci].expression + " /\\ " +
                // Get all constraints for this index
                cccConstraints4[ci].map((c: typeof CSPTools.CSPConstraint) => c.expression).join(" /\\ "));
        });
        cspModel.goal = "satisfy";

        return cspModel;

    }

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
            return new CSPTools.CSPConstraint("csc", "(" + c.expression + ") /\\ (" +
                cscPenaltyConstraints[ci].expression + ") \\/ (" + cscRewardConstraints[ci].expression + ")");
        });
        cspModel.goal = "satisfy";

        return cspModel;

    }

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

    buildOGT(): typeof CSPModel {

        var _pthis = this;
        // Store all utility function constraints for each "objective" inside a guarantee
        // FIXME: 
        this.guarantees.forEach((g, gi) => {
            // Store it by using guarantee index
            g.ofs.forEach((_of, _ofi) => {
                //TODO: check which kind of utility function to use.
                // Create utility variables
                let varUtil: typeof CSPTools.CSPVar = new CSPTools.CSPVar("ccc_utility" + gi + _ofi, new CSPTools.CSPRange(0, 1));
                // Create utility functions
                let constraintUtil: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
                    varUtil.id, "(" + varUtil.id + " == 1 /\\ (" + _of.objective + ")) xor (" +
                    varUtil.id + " == 0 /\\ not (" + _of.objective + "))");
                // Update model with new variables
                _pthis.cspModel.variables.push(varUtil);
                _pthis.cspModel.constraints.push(constraintUtil);
            });
        });

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

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
        cspModel.constraints = cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("ogt_" + ci, "(" + c.expression + ") /\\ (" +
                ogtPenaltyConstraints[ci].expression + ") /\\ (" + ogtRewardConstraints[ci].expression + ")");
        });
        cspModel.goal = "satisfy";

        // Get first metric to minimize
        if (this.metrics.length === 0) {
            throw "Unable to find a metric to minimize";
        } else {
            cspModel.goal = "minimize ccc_utility00";
        }

        return cspModel;

    }

    buildOBT(): typeof CSPModel {

        var _pthis = this;
        // Store all utility function constraints for each "objective" inside a guarantee
        // FIXME: 
        this.guarantees.forEach((g, gi) => {
            // Store it by using guarantee index
            g.ofs.forEach((_of, _ofi) => {
                //TODO: check which kind of utility function to use.
                // Create utility variables
                let varUtil: typeof CSPTools.CSPVar = new CSPTools.CSPVar("ccc_utility" + gi + _ofi, new CSPTools.CSPRange(0, 1));
                // Create utility functions
                let constraintUtil: typeof CSPTools.CSPConstraint = new CSPTools.CSPConstraint(
                    varUtil.id, "(" + varUtil.id + " == 1 /\\ (" + _of.objective + ")) xor (" +
                    varUtil.id + " == 0 /\\ not (" + _of.objective + "))");
                // Update model with new variables
                _pthis.cspModel.variables.push(varUtil);
                _pthis.cspModel.constraints.push(constraintUtil);
            });
        });

        let cfc = this.buildCFC(); // CFC(m,p,r,{CondP},{AsigP},{CondR},{AsigR})

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
        cspModel.constraints = cfc.constraints.map((c, ci) => {
            return new CSPTools.CSPConstraint("ogt_" + ci, "(" + c.expression + ") /\\ (" +
                ogtPenaltyConstraints[ci].expression + ") /\\ (" + ogtRewardConstraints[ci].expression + ")");
        });
        cspModel.goal = "satisfy";

        // Get first metric to maximize
        if (this.metrics.length === 0) {
            throw "Unable to find a metric to maximize";
        } else {
            cspModel.goal = "maximize ccc_utility00";
        }

        return cspModel;

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
        this.agreement.terms.guarantees.forEach(function(g: any, gi: number) {
            g.of.forEach(function(of: any, ofi: number) {
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