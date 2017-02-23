# Governify Agreement Analyzer
This application has been developed by following `project-template-nodejs` guidelines.
Features:
 - Perform local and remote CSP operations computed by `governify-csp-tools`.
 - //TODO: Validate agremeents model by schema.

All the CSP operations depends it depends on reasoner configuration file.

## Reasoner configuration file
It has to be defined by following the schema:

```yaml
---
title: Reasoner configuration file schema
type: 'object'
properties:
  type:
    enum:
    - 'api'
    - 'local'
    - 'docker'    # not implemented yet
  folder:
    type: 'string'
  api:            # only if type is 'api'
    type: 'object'
    properties:
      version:
        type: 'string'
      server:
        type: 'string'
      operationPath:
        type: 'string'

```

# API
## Model
Here you can find all necessary classes to model any problem.

### CSP

#### CSPConstraint
#### CSPModel
#### CSPParameter
#### CSPRange
#### CSPVar

## Translator

### IBuilder
This interface aims to be a generic way to builds a model from an `AgreementModel`.
E.g. `CSPBuilder` implements IBuilder interface in order to build a CSPModel from an `AgreementModel`.

All builders should be packed in a folder, e.g, CSPBuilder is found in `src/translator/csp` folder.

### Translator
This class contains all necessary methods to translate an `AgreementModel` to another type of model.

## Operators

### Analyzer
Defines analysis operations over an agremeent.

#### `isConsistent(agModel: Object, config: Object): boolean`
Checks if an agreement is consistent.###### Latest release

The version 0.0.1 is the latest stable version of governify-agreement-analyzer component.
see [release note](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1) for details.

For running:

- Download latest version from [0.0.1](http://github.com/isa-group/governify-agreement-analyzer/releases/tag/0.0.1)