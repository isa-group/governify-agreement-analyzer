"use strict";

const jsyaml = require("js-yaml");
const fs = require("fs");
const logger = require("../../src/logger/logger");
var expect = require("chai").expect;
var Promise = require("bluebird");

const folder = process.cwd() + "/tests/resources/agreements/cases-of-study";
const cspFolder = "csp_files";
const AgreementAnalyzer = require(process.cwd());
const expectedResults = require("../resources/agreements/cases-of-study/expected/results");

describe("Local compensation execution", function () {

    this.timeout(100000);

    it("", function (done) {

        // Read agreements in folder
        let promise = new Promise(function (resolve, reject) {

            fs.readdir(folder, function (err, files) {
                if (!err) {
                    resolve({
                        folder: folder,
                        files: files
                    });
                } else {
                    reject(err);
                }
            });

        }).then(function (obj) {

            var folder = obj.folder;
            var files = obj.files;

            var filePromises = [];
            // Create analyzer promises
            files.forEach(function (file) {
                filePromises.push(new Promise(function (resolve, reject) {
                    fs.stat(folder + "/" + file, function (err, stats) {
                        if (stats.isFile()) {
                            resolve(file);
                        } else {
                            resolve(); // ignore folders
                        }
                    });
                }));
            });

            var analyzerPromises = [];
            Promise.all(filePromises).then(function (files) {
                files.forEach(function (file) {
                    if (file) { // avoid folders
                        let analyzer = new AgreementAnalyzer({
                            agreement: {
                                file: "./tests/resources/agreements/cases-of-study/" + file
                            },
                            reasoner: {
                                type: "local",
                                folder: cspFolder
                            }
                        });
                        analyzerPromises.push({
                            analyzer: analyzer,
                            file: file
                        });
                    }
                });

                var allCompensationPromises = [];
                var cfcPromises = [];
                var vfcPromises = [];
                var cccPromises = [];
                var cscPromises = [];
                var gccPromises = [];
                var ogtPromises = [];
                var obtPromises = [];
                Promise.all(analyzerPromises).then(function (analyzers) {
                    analyzers.forEach(function (obj) {
                        var analyzer = obj.analyzer;
                        var file = obj.file;
                        // Create a promise for CFC executions
                        cfcPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableCFC(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "CFC"
                                });
                            });
                        }));
                        // Create a promise for VFC executions
                        vfcPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableVFC(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "VFC"
                                });
                            });
                        }));
                        // Create a promise for CCC executions
                        cccPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableCCC(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "CCC"
                                });
                            });
                        }));
                        // Create a promise for CSC executions
                        cscPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableCSC(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "CSC"
                                });
                            });
                        }));
                        // Create a promise for GCC executions
                        gccPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableGCC(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "GCC"
                                });
                            });
                        }));
                        // Create a promise for OGT executions
                        ogtPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableOGT(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "OGT"
                                });
                            });
                        }));
                        // Create a promise for OBT executions
                        obtPromises.push(new Promise(function (resolve, reject) {
                            analyzer.isSatisfiableOBT(function (err, stdout, stderr, sol) {
                                manageResolveReject(resolve, reject, {
                                    error: err,
                                    data: sol,
                                    file: file,
                                    type: "OBT"
                                });
                            });
                        }));
                    });

                    allCompensationPromises = cfcPromises.concat(vfcPromises).concat(cccPromises).concat(cscPromises).concat(gccPromises).concat(ogtPromises).concat(obtPromises);

                    Promise.all(allCompensationPromises).then(function (values) {
                        values.forEach(function (obj) {
                            logger.info(obj.file, obj.type, obj.data);
                            expect(obj.data).to.be.equal(getExpectedResult(obj.file, obj.type));
                        });
                        done();
                    }, function (reason) {
                        var type = reason.type;
                        var file = reason.file;
                        var error = reason.error;
                        logger.error("There was an error trying to execute", type, "on", file, error);
                        expect(error).to.be.equals(undefined);
                        done();
                    });

                }, function (obj) {
                    // var file = obj.file;
                    // var error = obj.error;
                    // logger.error("Error on " + file + ": " + error);
                    done();
                });

            }, function () {
                done();
            });

        }).catch(function (err) {
            done();
        });
    });

});

var getExpectedResult = function (file, type) {
    return expectedResults[file][type];
};

var manageResolveReject = function (resolve, reject, options) {

    let err = options.error;
    let sol = options.data;
    let file = options.file;
    let type = options.type;

    if (!err) {
        resolve({
            type: type,
            data: sol,
            file: file
        });
    } else {
        reject({
            type: type,
            data: sol,
            error: err,
            file: file
        });
    }

};