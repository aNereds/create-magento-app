/* eslint-disable max-len */
const { execAsyncSpawn } = require('../../util/exec-async-command');

/**
 * @param {Object} options
 * @param {number[]} [options.ports] Publish or expose port [docs](https://docs.docker.com/engine/reference/commandline/run/#publish-or-expose-port--p---expose)
 * @param {number[]} [options.mounts] Add bind mounts or volumes using the --mount flag [docs](https://docs.docker.com/engine/reference/commandline/run/#add-bind-mounts-or-volumes-using-the---mount-flag)
 * @param {number[]} [options.mountVolumes] Mount volume [docs](https://docs.docker.com/engine/reference/commandline/run/#mount-volume--v---read-only)
 * @param {Record<string, string>} [options.env] Set environment variables [docs](https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file)
 * @param {string} [options.image]
 * @param {string} [options.restart] Restart policies [docs](https://docs.docker.com/engine/reference/commandline/run/#restart-policies---restart)
 * @param {string} [options.name] Container name
 * @param {string} [options.entrypoint] Container entrypoint
 * @param {string} [options.command] Container command
 * @param {Record<"cmd" | "interval" | "retries" | "start-period" | "timeout", string>} [options.healthCheck] Container heathcheck properties
 * @param {string[]} [options.securityOptions] Security options [docs](https://docs.docker.com/engine/reference/commandline/run/#optional-security-options---security-opt)
 */
const run = (options) => {
    const {
        ports = [],
        mounts = [],
        mountVolumes = [],
        env = {},
        image,
        restart,
        network,
        name,
        entrypoint,
        command = '',
        healthCheck,
        securityOptions = []
    } = options;

    const restartArg = restart && `--restart ${ restart }`;
    const networkArg = network && `--network ${ network }`;
    const portsArgs = ports.map((port) => `-p ${ port }`).join(' ');
    const mountsArgs = mounts.map((mount) => `--mount ${ mount }`).join(' ');
    const mountVolumesArgs = mountVolumes.map((mount) => `-v ${mount}`).join(' ');
    const envArgs = Object.entries(env).map(([key, value]) => `--env ${ key }=${ value }`).join(' ');
    const nameArg = name && `--name ${name}`;
    const entrypointArg = entrypoint && `--entrypoint "${entrypoint}"`;
    const healthCheckArg = healthCheck && Object.entries(healthCheck).map(([key, value]) => `--health-${key} '${value}'`).join(' ');
    const securityArg = securityOptions.length > 0 && securityOptions.map((opt) => `--security-opt ${opt}`).join(' ');

    const dockerCommand = [
        'docker',
        'run',
        '-d',
        nameArg,
        networkArg,
        restartArg,
        portsArgs,
        mountsArgs,
        mountVolumesArgs,
        envArgs,
        entrypointArg,
        healthCheckArg,
        securityArg,
        image,
        command
    ].filter(Boolean).join(' ');

    return execAsyncSpawn(dockerCommand);
};

const stop = async (containers) => {
    const runningContainers = (await execAsyncSpawn('docker container ls --format "{{.Names}}"')).split('\n');

    const containersToStop = containers.filter((container) => runningContainers.includes(container));

    if (containersToStop.length === 0) {
        return;
    }

    await Promise.all(containersToStop.map(async (container) => {
        await execAsyncSpawn(`docker container stop ${container}`);
        await execAsyncSpawn(`docker container rm ${container}`);
    }));
};

const pull = async (image) => execAsyncSpawn(`docker pull ${image}`);

/**
 * @type {() => import('listr2').ListrTask<import('../../../typings/context').ListrContext>}
 */
const pullContainers = () => ({
    title: 'Pulling container images',
    task: async ({ config: { docker } }, task) => {
        const containers = Object.values(docker.getContainers());
        const containerFilters = containers
            .map((container) => `-f=reference='${container.imageDetails.name}:${container.imageDetails.tag}'`)
            .join(' ');
        const existingImages = await execAsyncSpawn(`docker images ${containerFilters} --format "{{.Repository}} {{.Tag}}"`);
        const existingImagesList = existingImages.split('\n').map((i) => i.split(' '));
        const missingContainerImages = containers
            .filter(
                (container) => !existingImagesList.some(
                    (i) => {
                        const [imageRepository, imageTag] = i;

                        return imageRepository === container.imageDetails.name && imageTag === container.imageDetails.tag;
                    }
                )
            );

        if (missingContainerImages.length === 0) {
            task.skip();
            return;
        }

        return task.newListr(
            missingContainerImages.map((container) => ({
                title: `Pulling ${container._} image`,
                task: () => pull(`${container.imageDetails.name}:${container.imageDetails.tag}`)
            })), {
                concurrent: true,
                exitOnError: true
            }
        );
    }
});

/**
 * @type {() => import('listr2').ListrTask<import('../../../typings/context').ListrContext>}
 */
const startContainers = () => ({
    title: 'Starting containers',
    task: async ({ ports, config: { docker } }, task) => {
        const containerList = await execAsyncSpawn('docker container ls');

        const missingContainers = Object.values(docker.getContainers(ports)).filter(
            ({ name }) => !containerList.includes(name)
        );

        if (missingContainers.length === 0) {
            task.skip();
            return;
        }

        // TODO: we might stop containers here ?
        await Promise.all(missingContainers.map((container) => run(container).then((out) => {
            task.output = `From ${container._}: ${out}`;
        })));
    },
    options: {
        bottomBar: 10
    }
});

/**
 * @type {() => import('listr2').ListrTask<import('../../../typings/context').ListrContext>}
 */
const stopContainers = () => ({
    title: 'Stopping Docker containers',
    task: async ({ ports, config: { docker } }, task) => {
        const containerList = await execAsyncSpawn('docker container ls -a');

        const runningContainers = Object.values(docker.getContainers(ports)).filter(
            ({ name }) => containerList.includes(name)
        );

        if (runningContainers.length === 0) {
            task.skip();
            return;
        }

        await stop(runningContainers.map(({ name }) => name));
    }
});

const getContainerStatus = async (containerName) => {
    try {
        return JSON.parse(await execAsyncSpawn(`docker inspect --format='{{json .State}}' ${containerName}`));
    } catch {
        return null;
    }
};

/**
 * @type {() => import('listr2').ListrTask<import('../../../typings/context').ListrContext>}
 */
const statusContainers = () => ({
    task: async (ctx) => {
        const { config: { docker }, ports } = ctx;
        const containers = Object.values(docker.getContainers(ports));

        ctx.containers = await Promise.all(
            containers.map(async (container) => ({
                ...container,
                status: await getContainerStatus(container.name)
            }))
        );
    },
    options: {
        bottomBar: 10
    }
});

module.exports = {
    startContainers,
    stopContainers,
    pullContainers,
    statusContainers
};
