const { buildProject, printError } = require('./script-utils');
const { join } = require('path');

async function buildData() {

	// Var declarations
	const projectFolder = join(__dirname, '..', 'ds-mongodb');
	await buildProject(projectFolder, 'ds-mongodb');

}

// Execution boilerplate
(async () => {
	try {
		await buildData();
	} catch (error) {
		printError('Error on Data build', error);
	}
})();

