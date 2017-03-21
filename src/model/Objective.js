"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Objective {
    constructor(objective, penalties, rewards) {
        this.objective = objective;
        this.penalties = penalties;
        this.rewards = rewards;
    }
}
exports.default = Objective;
