import { Controller, Get, Head, Post, Put, Delete, Options, Patch } from '../../../src/routes/routes.decorators';
import { Request, Response } from '../../../src/routes/routes.shared';

@Controller({ urlBase: '/test' })
export class ControllerExample {

	@Get()
	public async getTest(req: Request, res: Response) {
        return { method: 'getTest', test: 1 };
	}

	@Head()
	public async headTest(req: Request, res: Response) {
        return { method: 'headTest', test: 1 };
	}

	@Post()
	public async postTest(req: Request, res: Response) {
        return { method: 'postTest', test: 1 };
	}

	@Put()
	public async putTest(req: Request, res: Response) {
        return { method: 'putTest', test: 1 };
	}

	@Delete()
	public async deleteTest(req: Request, res: Response) {
        return { method: 'deleteTest', test: 1 };
	}

	@Options()
	public async optionsTest(req: Request, res: Response) {
        return { method: 'optionsTest', test: 1 };
	}

	@Patch()
	public async patchTest(req: Request, res: Response) {
        return { method: 'patchTest', test: 1 };
	}

}
