'use strict';

var url = require('url');

var Default = require('./DefaultService');

module.exports.analysisPOST = function analysisPOST (req, res, next) {
  Default.analysisPOST(req.swagger.params, res, next);
};
