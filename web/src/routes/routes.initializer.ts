import {IncomingMessage, Server, ServerResponse} from 'http';
import {
	ArrayUtils, ClassParameter, Configuration, Container, InjectConfiguration,
	InjectLogger, Logger, ObjectUtils, ObjectValidatorUtils, OnEvent,
	PublicEvents, Service, ValidatorUtils
} from '@plugdata/core';
import { FastifyMiddleware, RouteSchema, Plugin } from 'fastify';
import * as fastifyAuth from 'fastify-auth';
import * as oas from 'fastify-oas';
import { decode, encode } from 'jwt-simple';
import { WebConfiguration } from '../configuration/configuration.default';
import { JwtAvailableAlgorithms } from '../configuration/configuration.insterfaces';
import { RoutesService } from './routes.service';
import { ErrorResponseModel, Request, Response, TMethodOptions, IRegisteredController } from './routes.shared';
import { RoutesUtils } from './routes.utils';

@Service()
export class RoutesInitializer {

	private readonly eventNames = ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization'];

	private securityEnabled = false;
	private jwtConfiguration = {
		// Default private key, should be changed
		privateKey: '8981F9391AF549443CC7D5141B24D',
		algorithm: <JwtAvailableAlgorithms>'HS256',
		expiration: <number | undefined>undefined
	};

	constructor(
		@InjectLogger('httpcontroller') private log: Logger,
		private routesService: RoutesService,
		@InjectConfiguration() private configuration: Configuration
	) {

		this.securityEnabled = configuration.web && configuration.web.auth && configuration.web.auth.eanbled || false;

		// OAS configuration

		const defaultServers = { servers: [{ url: `http://${this.routesService.host}:${this.routesService.httpPort}` }] };
		const defaultConfiguration = ObjectUtils.deepMerge(WebConfiguration.default.web.oas, defaultServers);
		const oasConfiguration = (configuration.web && configuration.web.oas) ?
			ObjectUtils.deepMerge(defaultConfiguration, configuration.web.oas) : defaultConfiguration;
		const oasSecurity = configuration.web && configuration.web.auth && configuration.web.auth.securityInOas;
		const securityHamdlers: any[] = [];

		if (this.securityEnabled && oasSecurity) {
			if (oasSecurity.includes('jwt')) {
				securityHamdlers.push(this.routesService.fastifyInstance.verifyJwt);
			}
			if (oasSecurity.includes('basic')) {
				securityHamdlers.push(this.routesService.fastifyInstance.verifyUserAndPassword);
			}
		}

		this.routesService.fastifyInstance.register(oas, {
			routePrefix: oasConfiguration.documentationPath,
			exposeRoute: oasConfiguration.enableDocumentation,
			addModels: true,
			swagger: oasConfiguration
		});

		// Documentation route

		this.routesService.fastifyInstance.route({
			method: 'GET',
			url: oasConfiguration.oasPath,
			handler: (request, reply) => { reply.send(this.routesService.fastifyInstance.oas()); },
			schema: { hide: true },
			preHandler: securityHamdlers.length > 0 ? securityHamdlers : undefined
		});
	}

	@OnEvent(PublicEvents.allServicesLoaded)
	public onServicesReady() {
		this.log.debug('All services loaded, starting http server...');
		this.initHttpServer().then();
	}

	public async initHttpServer() {

		const restControllers = await Promise.all(this.getMethodsServices());

		if (this.securityEnabled) {
			this.routesService.fastifyInstance
				// Decorate fastify with login pre hnadle implementations
				.decorate('verifyJwt', this.verifyJwt.bind(this))
				.decorate('verifyUserAndPassword', this.verifyUserAndPassword.bind(this))
				// With this we are telling fastify that we will have a new property of the request object
				.decorateRequest('jwtPayload', undefined)
				// Auth plugin registration
				.register(fastifyAuth)
				// Auth routes
				.register(this.authPlugin);
		}

		this.routesService.fastifyInstance.register(this.methodsPlugin(restControllers));

		await this.routesService.startHttpServer();

	}

	private authPlugin: Plugin<Server, IncomingMessage, ServerResponse, fastifyAuth.Options> = (plugin, _, done) => {

		// Auth system

		if (this.configuration.web && this.configuration.web.auth && this.securityEnabled) {

			// Set jwt configuration
			this.jwtConfiguration.algorithm = this.configuration.web.auth.jwtAlgorithm || this.jwtConfiguration.algorithm;
			this.jwtConfiguration.privateKey = this.configuration.web.auth.jwtPrivateKey || this.jwtConfiguration.privateKey;
			this.jwtConfiguration.expiration = this.configuration.web.auth.jwtExpiration || this.jwtConfiguration.expiration;

			// Other vars
			const loginUrl = this.configuration.web.auth.jwtLoginPath || '/auth/login';

			// Register JWT login route
			plugin.route({
				method: 'POST',
				url: loginUrl,
				handler: this.handleJwtLogin.bind(this),
				schema: { hide: true }
			});

		}

		done();

	};

	private getMethodsServices() {

		const controllers = RoutesUtils.getAllControllers();
		return controllers.map(async controller => {

			// 1: Get service from di container
			const serviceId = (controller.options && controller.options.service && controller.options.service.sId) ?
				controller.options.service.sId : controller.controller;
			const context = (controller.options && controller.options.service && controller.options.service.ctx) ?
				controller.options.service.ctx : undefined;
			const controllerService = await Container.get<any>(serviceId, undefined, context);
			return { controllerService, controller };

		});

	}

	private methodsPlugin: (restControllers: {
		controllerService: any;
		controller: IRegisteredController;
	}[]) => Plugin<Server, IncomingMessage, ServerResponse, fastifyAuth.Options> = (restControllers) => (plugin, _, done) => {


		// We have to ensure that only the routes defined in this plugin have global security
		// this is why this is not defined in the 'authPlugin'
		let securityAlreadySet = false;
		if (this.configuration && this.configuration.web && this.configuration.web.auth && this.securityEnabled) {
			const securityInAllRoutes = this.configuration.web.auth.securityInAllRoutes;

			// Check if we have to apply security on all request
			if (securityInAllRoutes) {

				const securityHandlers: any[] = [];
				const securityTypes = Array.isArray(securityInAllRoutes) ?
					securityInAllRoutes : [securityInAllRoutes];

				if (securityTypes.includes('jwt')) {
					securityHandlers.push(plugin.verifyJwt);
				}
				if (securityTypes.includes('basic')) {
					securityHandlers.push(plugin.verifyUserAndPassword);
				}

				if (securityHandlers.length > 0) {
					const handler: FastifyMiddleware = plugin.auth(securityHandlers, { relation: 'or' });
					plugin.addHook('preHandler', handler);
					securityAlreadySet = true;
				}
			}
		}

		for (const restController of restControllers) {

			const methods = RoutesUtils.getRegisteredMethods(restController.controller.controller);

			// 2: Attach all controller methods to fastify methods
			for (const method of methods) {

				const controllerMethodHandler = restController.controllerService[method.methodName].bind(restController.controllerService);
				const controllerOptions: TMethodOptions = method.options || {};
				const url = restController.controller.options.urlBase + (method.path || '');

				// Check all events, since they can be names of custom functions of the service
				// and not stand alone functions.
				if (ArrayUtils.someContentsAreTheSame(Object.keys(controllerOptions), this.eventNames)) {
					for (const eventName of this.eventNames) {
						const possibleEventFunction = (<Record<string, any>>controllerOptions)[eventName];
						if (possibleEventFunction && typeof possibleEventFunction === 'function') {
							const functName = possibleEventFunction.name;
							if (restController.controller.controller.prototype[functName] === possibleEventFunction) {
								(<Record<string, any>>controllerOptions)[eventName] =
								restController.controllerService[functName].bind(restController.controllerService);
							}
						}
					}
				}

				// Route validations
				const routeSchemas = controllerOptions.routeSchemas;
				const schema: RouteSchema = controllerOptions.schema || {};
				if (routeSchemas) {

					if (method.httpMethod !== 'GET' && routeSchemas.request) {
						schema.body = this.isModelArray(routeSchemas.request) ?
							ObjectValidatorUtils.generateJsonSchema(routeSchemas.request.model, { asArray: true }) :
							ObjectValidatorUtils.generateJsonSchema(routeSchemas.request);
					}
					if (routeSchemas.response) {
						schema.response = {
							200: this.isModelArray(routeSchemas.response) ?
								ObjectValidatorUtils.generateJsonSchema(routeSchemas.response.model, { asArray: true }) :
								ObjectValidatorUtils.generateJsonSchema(routeSchemas.response),
							400: ObjectValidatorUtils.generateJsonSchema(ErrorResponseModel),
							500: ObjectValidatorUtils.generateJsonSchema(ErrorResponseModel)
						};
					}
					if (routeSchemas.parameters) {
						schema.querystring = ObjectValidatorUtils.generateJsonSchema(routeSchemas.parameters);
					}
					if (routeSchemas.urlParameters) {
						schema.params = ObjectValidatorUtils.generateJsonSchema(routeSchemas.urlParameters);
					}
					if (routeSchemas.headers) {
						schema.headers = ObjectValidatorUtils.generateJsonSchema(routeSchemas.headers);
					}
					controllerOptions.schema = schema;

				}
				controllerOptions.routeSchemas = undefined;

				// Check if we have to put some securty
				if (!securityAlreadySet && controllerOptions.security) {
					console.log({securityAlreadySet});
					const currentPreHandlers = controllerOptions.preHandler ?
						Array.isArray(controllerOptions.preHandler) ? controllerOptions.preHandler : [controllerOptions.preHandler] : [];
					const securityTypes = Array.isArray(controllerOptions.security) ? controllerOptions.security : [controllerOptions.security];
					const securityHamdlers: any[] = [];

					if (securityTypes.includes('jwt')) {
						securityHamdlers.push(plugin.verifyJwt);
					}
					if (securityTypes.includes('basic')) {
						securityHamdlers.push(plugin.verifyUserAndPassword);
					}

					if (securityHamdlers.length > 0 && this.securityEnabled) {
						// TODO, remove <any>
						controllerOptions.preHandler = <any>currentPreHandlers.concat(plugin.auth(
							securityHamdlers
						));
					}

				}

				const routeConfiguration = Object.assign(controllerOptions, {
					method: method.httpMethod,
					url,
					handler: controllerMethodHandler
				});

				plugin.route(routeConfiguration);

				this.log.debug(`Registered http method < ${restController.controller.controller.name} > ${method.httpMethod}  ${url}`);

			}

		}

		done();

	};

	private isModelArray(model: any): model is { isArray: true; model: ClassParameter<any> } {
		return model.isArray !== undefined && model.isArray === true;
	}

	private async handleJwtLogin(request: Request, reply: Response) {

		const payload = await RoutesUtils.jwtLoginFn(request);
		if (this.jwtConfiguration.expiration !== undefined) {
			payload['exp'] = ((new Date()).getTime() / 1000) + this.jwtConfiguration.expiration;
		}
		const token = encode(payload, this.jwtConfiguration.privateKey, this.jwtConfiguration.algorithm);
		reply.send({token});

	}

	private async verifyJwt(request: Request) {

		console.log('verifyJwt');
		const token = request.headers['authorization'] || request.headers['Authorization'];
		if (ValidatorUtils.isBlank(token)) {
			throw new Error('No JWT Token found in header "Authorization"');
		}
		const splitedToken = token.split(' ');
		if (splitedToken.length < 2 || splitedToken.length > 2 || splitedToken[0] !== 'Bearer') {
			throw new Error('Invalid value of header "Authorization", it should be: "Bearer xxxxx"');
		}
		const jwt = splitedToken[1];
		const jwtPayload = decode(jwt, this.jwtConfiguration.privateKey, undefined, this.jwtConfiguration.algorithm);

		request.jwtPayload = jwtPayload;
		console.log('verifyJwt2222');

	}

	private async verifyUserAndPassword(request: Request, respose: Response) {
		console.log('verifyUserAndPassword');
		const token = request.headers['authorization'] || request.headers['Authorization'];
		if (ValidatorUtils.isBlank(token)) {
			respose.header('WWW-Authenticate', 'Basic realm="Access to the server", charset="UTF-8"');
			throw new Error('Empty value of header "Authorization", it should be: "Basic xxxxx"');
		}
		const splitedToken = token.split(' ');
		if (splitedToken.length < 2 || splitedToken.length > 2 || splitedToken[0] !== 'Basic') {
			throw new Error('Invalid value of header "Authorization", it should be: "Basic xxxxx"');
		}

		const userAndPassword = Buffer.from(splitedToken[1], 'base64').toString('utf8');
		const userAndPasswordSplited = userAndPassword.split(':');
		if (userAndPasswordSplited.length !== 2) {
			throw new Error('Invalid basic auth value, it should be: "xxx:yyy"');
		}

		RoutesUtils.basicAuthLoginFn(userAndPasswordSplited[0], userAndPasswordSplited[1]);
		console.log('verifyUserAndPassword222');

	}

}
