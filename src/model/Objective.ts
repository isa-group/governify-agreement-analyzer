import Penalty from "./Penalty";
import Reward from "./Reward";

export default class Objective {

    constructor(public objective: string, public penalties: Penalty[], public rewards: Reward[]) { }

}