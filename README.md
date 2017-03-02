# Governify Agreement Analyzer
This is a Node.js API REST to analyze agreements defined on
[iAgree Specification](http://iagree.specs.governify.io/Specification/).

Some features:
 - Perform an agreement constraints consistency analysis.
 - Validate agreements by JSON schema validation.
 - Provide a API REST to perform agreement analysis operations.

The module has been developed in TypeScript and transpiled to JavaScript in order to be
executed as a Node.js module. Also, it has been developed by following the
[project-template-nodejs](https://github.com/isa-group/project-template-nodejs) 
guidelines.

All the CSP (Constraint Satisfaction Problem) analysis operations are executed by using
[governify-csp-tools](https://github.com/isa-group/governify-csp-tools)
project, which provides the possibility to configure a Reasoner to solve the CSP
in differents environmenets: local, remote or docker.
Check out the [GitHub documentation](https://github.com/isa-group/governify-csp-tools)
to configure the Reasoner.

## How to use this application
1. **Set** the Reasoner configuration of CSP Tools in `./src/configurations/reasoner.yaml`.
2. **Start** the API REST by executing: `npm start`.
3. **Test** the API by performing a post request to `http://localhost:8080/api/v1/analysis/isConsistent`
with the example body:
```json
{
	"fileUrl": "https://gist.githubusercontent.com/feserafim/eaba5c2ad4eb82245c2eca154a64c264/raw/732706de8e1b12e6b8c4e75bb02802b165779b17/agreement-valid.yaml"
}
```

## API
### CSPModel
Models a CSP based on [CSP YAML Schema](https://github.com/isa-group/governify-csp-tools#).

- CSPConstraint
- CSPModel
- CSPParameter
- CSPRange
- CSPVar

### Translator

#### IBuilder
This interface aims to be a generic way to build a model from an `AgreementModel`.
E.g. `CSPBuilder` implements IBuilder interface in order to build a CSPModel from an `AgreementModel`.

All builders should be packed in a folder, e.g: CSPBuilder is found in `./src/translator/csp` folder.

#### Translator
This class contains all necessary methods to translate an `AgreementModel` to another type of model.

### Operators

#### Analyzer
Defines analysis operations over an agreement.

##### `isConsistent(agModel: Object, config: Object): boolean`
Checks if the agreement constraints are consistent.

#### Latest release

The version 0.0.1 is the latest stable version of governify-agreement-analyzer component.
see [release note](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1) for details.

For running:

- Download latest version from [0.0.1](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1)

[![Build Status](https://travis-ci.org/isa-group/governify-agreement-analyzer.svg?branch=master)](https://travis-ci.org/http://github.com/isa-group/governify-agreement-analyzer)