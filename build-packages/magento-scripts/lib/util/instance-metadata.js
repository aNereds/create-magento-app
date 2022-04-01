const logger = require('@scandipwa/scandipwa-dev-utils/logger');

const WEB_LOCAL_LOCATION_TITLE = `Location on ${ logger.style.misc('localhost') }`;
const WEB_LOCATION_TITLE = 'Location on the Web';
const WEB_ADMIN_LOCATION_TITLE = 'Panel location';
const WEB_ADMIN_CREDENTIALS_TITLE = 'Panel credentials';
const WEB_MAILDEV_LOCATION_TITLE = 'Panel location';

const mapDataStyle = ({ title, text }) => ({
    title,
    text: logger.style.link(text)
});

/**
 * @param {import("../../typings/context").ListrContext} ctx
 * @return {{ frontend: { title: string, text: string }[], admin: { title: string, url: string }[], maildev: { title: string, url: string }[] }}
 */
const getInstanceMetadata = (ctx) => {
    const {
        ports,
        config: {
            magentoConfiguration,
            overridenConfiguration: { host, ssl }
        }
    } = ctx;

    /**
     * @type {{ title: string, text: string }[]}
     */
    const frontend = [];

    /**
     * @type {{ title: string, text: string }[]}
     */
    const admin = [];

    /**
     * @type {{ title: string, text: string }[]}
     */
    const maildev = [];

    const isNgrok = host.endsWith('ngrok.io');

    if (isNgrok) {
        frontend.push({
            title: WEB_LOCAL_LOCATION_TITLE,
            text: `${ssl.enabled ? 'https' : 'http'}://localhost${ssl.enabled || ports.app === 80 ? '' : `:${ports.app}`}/`
        });
        frontend.push({
            title: WEB_LOCATION_TITLE,
            text: `${ssl.enabled ? 'https' : 'http'}://${host}/`
        });
    } else {
        frontend.push({
            title: WEB_LOCATION_TITLE,
            text: `${ssl.enabled ? 'https' : 'http'}://${host}${ssl.enabled || ports.app === 80 ? '' : `:${ports.app}`}/`
        });
    }

    const webLocation = frontend.find((u) => u.title === WEB_LOCATION_TITLE);

    admin.push({
        title: WEB_ADMIN_LOCATION_TITLE,
        text: logger.style.link(`${webLocation.text}admin`)
    });

    admin.push({
        title: WEB_ADMIN_CREDENTIALS_TITLE,
        text: `${logger.style.misc(magentoConfiguration.user)} - ${logger.style.misc(magentoConfiguration.password)}`
    });

    maildev.push({
        title: WEB_MAILDEV_LOCATION_TITLE,
        text: `http://${host}:${ports.maildevWeb}/`
    });

    return {
        admin,
        frontend: frontend.map(mapDataStyle),
        maildev: maildev.map(mapDataStyle)
    };
};

module.exports = {
    getInstanceMetadata
};
