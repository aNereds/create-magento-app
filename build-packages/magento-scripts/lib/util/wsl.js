const os = require('os');

const isWSL = os.release().includes('WSL');

module.exports = {
    isWSL
};
