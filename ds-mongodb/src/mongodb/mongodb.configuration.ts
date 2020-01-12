import { ConnectionConfiguration, IsString, Required } from '@plugcore/core';
import { MongoClientOptions } from 'mongodb';

export class MongodbDsConfiguration implements ConnectionConfiguration {

	@Required()
	@IsString({
		pattern: 'mongodb'
	})
	type: string;

	@Required()
	@IsString({
		pattern: '(^(mongodb:(?:\/{2})?)((\w+?):(\w+?)@|:?@?)(\w+?):(\d+)\/(\w+?)$)|nedb'
	})
	url: string;

	@Required()
	@IsString()
	databaseName: string;

	options?: Omit<MongoClientOptions, 'logger' | 'loggerLevel'>;

}
