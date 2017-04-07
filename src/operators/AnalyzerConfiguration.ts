/*!
governify-agreement-analyzer 0.4.0, built on: 2017-04-07
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


class ApiConfiguration {
    version: string;
    server: string;
    operationPath: string;
}

class ReasonerConfiguration {
    type: string;
    folder: string;
    api: ApiConfiguration;
    constructor() {
        this.api = new ApiConfiguration();
    }
}

class AgreementConfiguration {
    url: string;
    file: string;
    content: Object;
}

export default class AnalyzerConfiguration {

    agreement: AgreementConfiguration;
    reasoner: ReasonerConfiguration;

    constructor() {
        this.agreement = new AgreementConfiguration();
        this.reasoner = new ReasonerConfiguration();
    }
}