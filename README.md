# Governify Agreement Analyzer
This is a Node.js API REST to analyze agreements defined by following the [iAgree Specification](http://iagree.specs.governify.io/Specification/).

**Governify Agreement Analyzer** provides some features, such as:
 - An API for programmers to peform agreement analysis operations.
 - An API REST to peform agreement analysis operations over a service.

**Governify Agreement Analyzer** executes all CSP by using the **Reasoner** tool defined on [governify-csp-tools](https://github.com/isa-group/governify-csp-tools) project, which in turn executes the CSP based on [MiniZinc](http://www.minizinc.org/) language.

**Governify Agreement Analyzer** has been developed on TypeScript and transpiled to JavaScript in order to be
executed as a Node.js module. Also, it has been developed by following the [project-template-nodejs](https://github.com/isa-group/project-template-nodejs) development guidelines.

## Install
```bash
$ npm install governify-agreement-analyzer
```

## Basic usage
You can easily use this library in your project:
```javascript
// Import
var AgreementAnalyzer = require("governify-agreement-analyzer");

// Configure analyzer
var config = {
    agreement: {
        file: "agreement.yaml"
    },
    reasoner: {
      type: "api",
      folder: "csp_files",
      api: {
        version: "v2",
        server: "https://designer.governify.io:10044/module-minizinc",
        operationPath: "models/csp/operations/execute"
      }
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
```
or deploy the analyzer as an API REST service:
```javascript
// Import Agreement Analyzer API
var AgreementAnalyzerServer = require("governify-agreement-analyzer").api;
var api = new AgreementAnalyzerServer();
var app = require("connect")();

// Start API
api.initialize(app);
```
Once you deploy the API REST, you can now send a POST request over `http://localhost:8080/api/v1/analysis/isConsistent` with the configuration of Analyzer.

You can download `agreement.yaml` [here]().

Follow the [analyzer configuration](#analyzer-configuration) for more details.

## Analyzer configuration
An example:
```javascript
var configuration = { 
  "agreement": {
    "file": "agreement.yaml" // use 'url' property for remote agreements 
  },
  "reasoner": {
    "type": "local",
    "folder": "csp_files"
  }
}
```

Please, consider:
  - **Reasoner** can be configured for local, remote or docker execution. Please, take a look at [reasoner documentation](https://github.com/isa-group/governify-csp-tools#reasoner-configuration) to know which are the requirements to run reasoner in each environment.
  - Use `agreement.file` property to define use an local agreement file located in your project. You can also use `agreement.url` to define a remote agreement file.

The JSON schema associated to analyzer configuration:
```yaml
---
type: 'object'
properties:
  agreement:
    type: 'object'
    properties:
      file:
        type: 'string'
      url: 
        type: 'string'
  reasoner:
    # Reasoner configuration of governify-csp-tools project
    type: 'object'
    properties:
      type:
        enum:
        - 'local'
        - 'api'
        - 'docker'
      folder:
        type: 'string' 
      api:
        type: 'object'
        properties:
          version:
            type: 'string'
          server:
            type: 'string'
          operationPath:
            type: 'string'
    required:
      - 'type'
      - 'folder'
```

## Latest release

The version 0.0.1 is the latest stable version of governify-agreement-analyzer component.
see [release note](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1) for details.

For running:

- Download latest version from [0.0.1](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1)

[![Build Status](https://travis-ci.org/isa-group/governify-agreement-analyzer.svg?branch=master)](https://travis-ci.org/http://github.com/isa-group/governify-agreement-analyzer)