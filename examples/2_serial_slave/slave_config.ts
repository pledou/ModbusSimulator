// @ts-check
'use strict'

import { config } from '../../src/config/config.ts';

/**
 * Toggle a DI input every 5 seconds
 * @param {*} unittodata 
 */
function setUnitToData(unittodata: any) {
    if (!unittodata[0x01]) return;

    setInterval(() => {
        if (unittodata[0x01].discreteInputs) {
            unittodata[0x01].discreteInputs[0] = 
                unittodata[0x01].discreteInputs[0] ? false : true;
            unittodata[0x01].discreteInputs.listener.emit(
                'change:0', 
                unittodata[0x01].discreteInputs[0]
            );
        }
    }, 5000);
}

export default setUnitToData;
