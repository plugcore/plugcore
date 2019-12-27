import { ListenOptions } from 'fastify';
import {
	ComponentsObject, ExternalDocumentationObject, InfoObject, SchemasObject,
	SecurityRequirementObject, Server, TagObject
} from 'openapi3-ts';

export type JwtAvailableAlgorithms = 'HS256' | 'HS384' | 'HS512' | 'RS256';

export interface WebOasConfiguration {
	enableDocumentation?: boolean;
	documentationPath?: string;
	info?: InfoObject;
	externalDocs?: ExternalDocumentationObject;
	host?: string;
	basePath?: string;
	schemes?: SchemasObject | string[];
	consumes?: string[];
	produces?: string[];
	security?: Record<string, any> | SecurityRequirementObject[];
	servers?: Server[];
	components?: ComponentsObject;
	tags?: TagObject[];
}

export interface WebAuthConfiguration {
	eanbled?: boolean;
	securityInAllRoutes?: 'basic' | 'jwt' | ('basic' | 'jwt')[];
	securityInOas?: 'basic' | 'jwt' | ('basic' | 'jwt')[];
	jwtPrivateKey?: string;
	jwtAlgorithm?: JwtAvailableAlgorithms;
	jwtLoginPath?: string;
	jwtExpiration?: number;
}

export interface PlugWebConfiguration {
	server?: ListenOptions;
	oas?: WebOasConfiguration;
	auth?: WebAuthConfiguration;
}

declare module '@plugdata/core/types/src/configuration/configuration.interfaces' {
	interface Configuration {
		web?: PlugWebConfiguration;
	}
}
