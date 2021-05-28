/* eslint-disable no-continue, no-await-in-loop, no-restricted-syntax */
const logger = require('@scandipwa/scandipwa-dev-utils/logger');
const { Listr } = require('listr2');
const path = require('path');
const { getProjects } = require('../config/config');
const stop = require('../tasks/stop');
const pathExists = require('../util/path-exists');

module.exports = (yargs) => {
    yargs.command('stop-all', 'Stop all running applications on your machine.', () => {}, async () => {
        // if (!isInstalledGlobally) {
        //     throw new Error('This command works only in global mode.');
        // }

        const allProjects = getProjects();

        for (const [projectPath] of Object.entries(allProjects)) {
            if (!await pathExists(path.join(projectPath, 'composer.json'))) {
                logger.note(`No composer.json found inside ${projectPath} directory, skipping...`);
                continue;
            }
            logger.warn(`Stopping application ${ projectPath }`);
            const tasks = new Listr([
                stop
            ], {
                concurrent: false,
                exitOnError: true,
                rendererOptions: {
                    collapse: false
                },
                ctx: {
                    throwMagentoVersionMissing: true,
                    projectPath
                }
            });

            await tasks.run();
        }
        logger.logN('All applications stopped successfully!');
    });
};
