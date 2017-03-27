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
const Analyzer = require("../../src/operators/Analyzer").default;
const fs = require("fs");
const logger = ("../../src/logger/logger");

describe('Local reasoner consistency tests', function () {

    this.timeout(600000);

    // Local agreements

    describe('Local agreement files', function () {

        it('Satisfiable agreement returns true', function (done) {

            // Create local analyzer for local satisfiable agreement
            var analyzer = new Analyzer({
                agreement: {
                    file: "./tests/resources/agreements/agreement-valid.yaml"
                },
                reasoner: {
                    type: 'local',
                    folder: 'csp_files_test'
                }
            });

            analyzer.isConsistent(function (err, stdout, stderr, isSatisfiable) {
                expect(isSatisfiable).to.be.equal(true);
                done();
            });

        });

        it('Inconsistent agreement returns unsatisfied message', function (done) {

            // Create local analyzer for local inconsistent agreement
            var analyzer = new Analyzer({
                agreement: {
                    file: "./tests/resources/agreements/agreement-inconsistent.yaml"
                },
                reasoner: {
                    type: 'local',
                    folder: 'csp_files_test'
                }
            });

            analyzer.isConsistent(function (err, stdout, stderr, isSatisfiable) {
                expect(stdout.indexOf("=====UNSATISFIABLE=====") !== -1).to.be.equal(true);
                expect(stderr.indexOf("model inconsistency detected") !== -1).to.be.equal(true);
                done();
            });

        });

        it('Operation over invalid agreement throws expected error', function (done) {

            // Create local analyzer for local invalid agreement
            var analyzer = new Analyzer({
                agreement: {
                    file: "./tests/resources/agreements/agreement-invalid.yaml"
                },
                reasoner: {
                    type: 'local',
                    folder: 'csp_files_test'
                }
            });

            analyzer.isConsistent(function (err, stdout, stderr, isSatisfiable) {
                expect(!!err).to.be.equal(true);
                done();
            });

        });

    });

    // Remote agreements

    describe('Remote agreement files', function () {

        it('Satisfiable agreement returns true', function (done) {

            // Create local analyzer for Remote satisfiable agreement
            var analyzer = new Analyzer({
                agreement: {
                    url: "https://gist.github.com/feserafim/eaba5c2ad4eb82245c2eca154a64c264/raw/732706de8e1b12e6b8c4e75bb02802b165779b17/agreement-valid.yaml"
                },
                reasoner: {
                    type: 'local',
                    folder: 'csp_files_test'
                }
            });

            analyzer.isConsistent(function (err, stdout, stderr, isSatisfiable) {
                expect(isSatisfiable).to.be.equal(true);
                done();
            });

        });

        it('Inconsistent agreement returns unsatisfied message', function (done) {

            // Create local analyzer for Remote inconsistent agreement
            var analyzer = new Analyzer({
                agreement: {
                    url: "https://gist.github.com/feserafim/01b9bdd21b3e047e166c32c0cfe5ecac/raw/258a622c3bd8e833ef5ffac2c2c3b1fc84614dc2/agreement-inconsistent.yaml"
                },
                reasoner: {
                    type: 'local',
                    folder: 'csp_files_test'
                }
            });

            analyzer.isConsistent(function (err, stdout, stderr, isSatisfiable) {
                expect(stdout.indexOf("=====UNSATISFIABLE=====") !== -1).to.be.equal(true);
                expect(stderr.indexOf("model inconsistency detected") !== -1).to.be.equal(true);
                done();
            });

        });

        it('Operation over invalid agreement throws expected error', function (done) {

            // Create local analyzer for Remote invalid agreement
            var analyzer = new Analyzer({
                agreement: {
                    url: "https://gist.github.com/feserafim/3a19701b319e7b7f6b63cdac3184c1ff/raw/61064cc6a6261c3da4d2171c5b9df644b6dddc66/agreement-invalid.yaml"
                },
                reasoner: {
                    type: 'local',
                    folder: 'csp_files_test'
                }
            });

            analyzer.isConsistent(function (err) {
                expect(!!err).to.equal(true);
                done();
            });

        });

    });

});