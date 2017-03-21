'use strict';

var AgreementModel = require('./src/model/AgreementModel').default;
var AgreementAnalyzer = require('./src/operators/Analyzer').default;
var AgreementCompensationCSPModelBuilder = require('./src/builder/AgreementCompensationCSPModelBuilder').default

function SwaggerServer() {}

SwaggerServer.prototype.initialize = (app) => {

    // Disable tls rejection
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

    var http = require('http');
    var swaggerTools = require('swagger-tools');
    var jsyaml = require('js-yaml');
    var fs = require('fs');
    var serverPort = 8080;

    // swaggerRouter configuration
    var options = {
        swaggerUi: '/swagger.json',
        controllers: './src/controllers',
        useStubs: process.env.NODE_ENV === 'development' ? true : false // Conditionally turn on stubs (mock mode)
    };

    // The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
    var spec = fs.readFileSync('./src/api/swagger.yaml', 'utf8');
    var swaggerDoc = jsyaml.safeLoad(spec);

    // Initialize the Swagger middleware
    swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
        // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
        app.use(middleware.swaggerMetadata());

        // Validate Swagger requests
        app.use(middleware.swaggerValidator());

        // Route validated requests to appropriate controller
        app.use(middleware.swaggerRouter(options));

        // Serve the Swagger documents and Swagger UI
        app.use(middleware.swaggerUi());

        // Start the server
        http.createServer(app).listen(serverPort, function () {
            console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
            console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
        });
    });

};

AgreementAnalyzer.api = SwaggerServer;
AgreementAnalyzer.AgreementModel = AgreementModel;
AgreementAnalyzer.AgreementCompensationCSPModelBuilder = AgreementCompensationCSPModelBuilder;

module.exports = AgreementAnalyzer;