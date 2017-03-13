// Import Agreement Analyzer API
// var AgreementAnalyzerServer = require('../').api;
// var api = new AgreementAnalyzerServer();
// var app = require('connect')();

// // Start API
// api.initialize(app);

// ###

// Import
var AgreementAnalyzer = require('../');

// Configure analyzer
var config = {
    agreement: {
        file: 'examples/agreement.yaml'
    },
    reasoner: {
        type: 'docker',
        folder: 'csp_files'
    }
};

// Create an Analyzer instance
var analyzer = new AgreementAnalyzer(config);

// Execute an analysis operation
analyzer.isConsistent(function (err, sol) {
    if (err) {
        // manage error
        console.log(err);
    } else {
        console.log(sol);
    }
});

analyzer.isSatisfiableCFC(function (err, sol) {
    
});