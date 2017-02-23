# Governify Agreement Analyzer
This is a Node.js API REST to analyze agreements defined on
[iAgree specification](http://iagree.specs.governify.io/).
The module has been developed in TypeScript and transpiled to JavaScript in order to be
executed as a Node.js module. Also, it has been developed by following the
[project-template-nodejs](https://github.com/isa-group/project-template-nodejs) 
guidelines.

Some features:
 - Perform an agreement constraints consistency analysis.
 - Validate agremeents model by schema.
 - Mocha tests.

All the CSP (Constraint Satisfaction Problem) analysis operations are executed by using 
[governify-csp-tools](https://github.com/isa-group/governify-csp-tools)
project. Governify CSP Tools provides the possibility to solve CSP in local, remote and docker.
Please, check out its [GitHub documentation](https://github.com/isa-group/governify-csp-tools) to know more.

## How to use this application
1. Set the reasoner configuration of CSP Tools in `./src/configurations/reasoner.yaml`.
2. Start API REST by executing: `npm start`.

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
Defines analysis operations over an agremeent.

##### `isConsistent(agModel: Object, config: Object): boolean`
Checks if the agreement constraints are consistent.

## Latest release

The version 0.0.1 is the latest stable version of governify-agreement-analyzer component.
see [release note](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1) for details.

For running:

- Download latest version from [0.0.1](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1)