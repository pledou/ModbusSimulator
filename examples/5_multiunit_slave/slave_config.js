// @ts-check
'use strict'

/**
 * Multi-unit slave behavior
 * @param {*} unittodata 
 */
function setUnitToData(unittodata) {
    // Unit 1 (0x01) operations
    if (unittodata[0x01]) {
        setInterval(() => {
            const current = unittodata[0x01].discreteInputs[0];
            unittodata[0x01].discreteInputs[0] = !current;
            unittodata[0x01].discreteInputs.listener.emit('change:0', !current);
        }, 1000);
    }

    // Unit 2 (0x02) operations
    if (unittodata[0x02]) {
        setInterval(() => {
            const val = unittodata[0x02].holdingRegisters.readUInt16BE(4000);
            unittodata[0x02].holdingRegisters.writeUInt16BE(val + 1, 4000);
            unittodata[0x02].holdingRegisters.listener.emit('change:2000', val + 1);
        }, 500);
    }

    // Unit 3 (0x03) operations
    if (unittodata[0x03]) {
        setInterval(() => {
            const current = unittodata[0x03].discreteInputs[0];
            unittodata[0x03].discreteInputs[0] = !current;
            unittodata[0x03].discreteInputs.listener.emit('change:0', !current);
        }, 2000);
    }
}

module.exports = setUnitToData;
