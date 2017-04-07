/*!
project-template-nodejs 0.0.0, built on: 2017-02-10
Copyright (C) 2017 ISA group
http://www.isa.us.es/
https://github.com/isa-group/project-template-nodejs

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


'use strict';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"; // unsecure

const expect = require('chai').expect;
const fs = require("fs");
const yaml = require("js-yaml");
const logger = ("../src/logger/logger");
const AgreementModel = require("../src/model/AgreementModel").default;
const testConfig = require(".");

/*
 * USE MOCHA AND CHAI for testing your code
 */
describe('Agreement model validation', function () {

    this.timeout(10000);

    describe('Using a valid agreement', function () {
        it('is valid', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-valid.yaml", "utf8", function (err, agreement) {
                var _model = yaml.safeLoad(agreement);
                var agModel = new AgreementModel(_model);
                expect(agModel.validate()).to.be.equal(true);
                done();
            });

        });
    });

    describe('Using an invalid agreement', function () {
        it('is invalid', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-invalid.yaml", "utf8", function (err, agreement) {
                var _model = yaml.safeLoad(agreement);
                var agModel = new AgreementModel(_model);
                expect(agModel.validate()).to.be.equal(false);
                done();
            });

        });
    });
});