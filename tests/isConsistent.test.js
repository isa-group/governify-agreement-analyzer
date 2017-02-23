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
const Analyzer = require("../src/operators/Analyzer").default;
const fs = require("fs");
const logger = ("../src/logger/logger");


/*
 * USE MOCHA AND CHAI for testing your code
 */
describe('Analyzer operations', function () {

    this.timeout(10000);

    describe('Local', function () {
        it('is consistent', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-valid.yaml", "utf8", function (err, agreement) {
                if (err) {
                    return console.log(err);
                }
                try {
                    new Analyzer(agreement).isConsistent(function (err, sol) {
                        expect(sol).to.be.equal(true);
                        done();
                    }, {
                        type: 'local',
                        folder: 'test_csp_files'
                    });
                } catch (err) {
                    logger.error(err);
                    done();
                }
            });

        });

        it('is inconsistent', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-inconsistent.yaml", "utf8", function (err, agreement) {
                if (err) {
                    return console.log(err);
                }
                new Analyzer(agreement).isConsistent(function (err, sol) {
                    expect(sol).to.be.equal(false);
                    done();
                }, {
                    type: 'local',
                    folder: 'test_csp_files'
                });
            });

        });
    });

    describe('Remote', function () {
        it('is consistent', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-valid.yaml", "utf8", function (err, agreement) {
                if (err) {
                    return console.log(err);
                }
                new Analyzer(agreement).isConsistent(function (err, sol) {
                    expect(sol).to.be.equal(true);
                    done();
                }, {
                    type: 'api',
                    folder: 'test_csp_files',
                    api: {
                        version: 'v2',
                        server: 'https://designer.governify.io:10044/module-minizinc',
                        operationPath: 'models/mzn/operations/execute'
                    }
                });
            });

        });

        it('is inconsistent', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-inconsistent.yaml", "utf8", function (err, agreement) {
                if (err) {
                    return console.log(err);
                }
                new Analyzer(agreement).isConsistent(function (err, sol) {
                    expect(sol).to.be.equal(false);
                    done();
                }, {
                    type: 'api',
                    api: {
                        version: 'v2',
                        server: 'https://designer.governify.io:10044/module-minizinc',
                        operationPath: 'models/mzn/operations/execute'
                    }
                });
            });
        });
    });

    describe('Docker', function () {
        it('is consistent', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-valid.yaml", "utf8", function (err, agreement) {
                if (err) {
                    return console.log(err);
                }
                new Analyzer(agreement).isConsistent(function (err, sol) {
                    expect(sol).to.be.equal(true);
                    done();
                }, {
                    type: 'docker',
                    folder: 'test_csp_files'
                });
            });

        });

        it('is inconsistent', (done) => {

            fs.readFile("./tests/resources/agreements/agreement-inconsistent.yaml", "utf8", function (err, agreement) {
                if (err) {
                    return console.log(err);
                }
                new Analyzer(agreement).isConsistent(function (err, sol) {
                    expect(sol).to.be.equal(false);
                    done();
                }, {
                    type: 'docker',
                    folder: 'test_csp_files'
                });
            });
        });
    });

});