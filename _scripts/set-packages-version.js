const { consolePromt, printError, versionCompare, loadJsonFile, saveObjectAsJsonFile } = require('./script-utils');
const { join } = require('path');

async function setPackagesVersion() {

	// Var declarations
	const corePackageJsonPath = join(__dirname, '..', 'core', 'package.json');
	const corePublishPackageJsonPath = join(__dirname, '..', 'core', 'publish', 'package.json');
	const webPackageJsonPath = join(__dirname, '..', 'web', 'package.json');
	const webPublishPackageJsonPath = join(__dirname, '..', 'web', 'publish', 'package.json');
	const dataPackageJsonPath = join(__dirname, '..', 'data', 'package.json');
	const dataPublishPackageJsonPath = join(__dirname, '..', 'data', 'publish', 'package.json');

	const corePackageJson = await loadJsonFile(corePackageJsonPath);
	const currentVersion = corePackageJson.version;
	const newVersion = await consolePromt(`Current version is ${currentVersion}, set the new version: \n`);

	if (versionCompare(currentVersion, newVersion) < 0) {

		// Version update
		const corePublishPackageJson = await loadJsonFile(corePublishPackageJsonPath);
		const webPackageJson = await loadJsonFile(webPackageJsonPath);
		const webPublishPackageJson = await loadJsonFile(webPublishPackageJsonPath);
		const dataPackageJson = await loadJsonFile(dataPackageJsonPath);
		const dataPublishPackageJson = await loadJsonFile(dataPublishPackageJsonPath);

		// JSON files updates
		await Promise.all([
			saveObjectAsJsonFile(corePackageJsonPath, corePackageJson),
			saveObjectAsJsonFile(corePublishPackageJsonPath, corePublishPackageJson),
			saveObjectAsJsonFile(webPackageJsonPath, webPackageJson),
			saveObjectAsJsonFile(webPublishPackageJsonPath, webPublishPackageJson),
			saveObjectAsJsonFile(dataPackageJsonPath, dataPackageJson),
			saveObjectAsJsonFile(dataPublishPackageJsonPath, dataPublishPackageJson)
		]);

	} else {
		throw new Error(`Version ${newVersion} is not greater than ${currentVersion}`);
	}

}

// Execution boilerplate
(async () => {
	try {
		await setPackagesVersion();
	} catch (error) {
		printError('Error while setting new version for packages', error);
	}
})();


