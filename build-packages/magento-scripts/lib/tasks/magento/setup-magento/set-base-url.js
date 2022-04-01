const { updateTableValues } = require('../../../util/database');

/**
 * @type {() => import('listr2').ListrTask<import('../../../../typings/context').ListrContext>}
 */
module.exports = () => ({
    title: 'Setting baseurl and secure baseurl',
    task: async (ctx, task) => {
        const {
            ports,
            config: { overridenConfiguration: { host, ssl } },
            mysqlConnection
        } = ctx;
        const isNgrok = host.endsWith('ngrok.io');
        const enableSecureFrontend = ssl.enabled ? '1' : '0';
        const location = `${host}${ !isNgrok && ports.app !== 80 ? `:${ports.app}` : '' }/`;
        const secureLocation = `${host}/`; // SSL will work only on port 443, so you cannot run multiple projects with SSL at the same time.
        const httpUrl = `http://${location}`;
        const httpsUrl = `https://${secureLocation}`;

        await updateTableValues('core_config_data', [
            { path: 'web/unsecure/base_url', value: httpUrl },
            { path: 'web/secure/base_url', value: httpsUrl },
            { path: 'web/secure/use_in_frontend', value: enableSecureFrontend },
            { path: 'web/secure/use_in_adminhtml', value: enableSecureFrontend },
            { path: 'web/cookie/cookie_domain', value: null }
        ], { mysqlConnection, task });
    }
});
