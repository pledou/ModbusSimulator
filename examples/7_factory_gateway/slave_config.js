// @ts-check
'use strict'

/**
 * Factory slave behavior with simulated values
 * @param {*} unittodata 
 * @param {*} mqttclient 
 */
function setUnitToData(unittodata, mqttclient) {
    if (!unittodata[0x01]) return;

    const unit = unittodata[0x01];

    // Simulate pressure variations
    let pressure = 5.0;
    setInterval(() => {
        pressure += (Math.random() - 0.5) * 0.5;
        pressure = Math.max(0, Math.min(15, pressure));
        
        unit.inputRegisters.writeFloatBE(pressure, 200);
        unit.inputRegisters.listener.emit('change:100', pressure);
    }, 500);

    // Simulate temperature based on heater
    let temp = 20;
    setInterval(() => {
        const heaterOn = unit.coils[3]; // Heater_On
        if (heaterOn) {
            temp = Math.min(80, temp + 0.5);
        } else {
            temp = Math.max(20, temp - 0.2);
        }
        unit.inputRegisters.writeInt16BE(Math.floor(temp), 202);
        unit.inputRegisters.listener.emit('change:101', Math.floor(temp));
    }, 1000);

    // Simulate motor speed based on motor enable
    let speed = 0;
    setInterval(() => {
        const motorOn = unit.coils[1]; // Motor_Run
        const speedSetpoint = unit.holdingRegisters.readUInt16BE(2002);
        
        if (motorOn) {
            speed = Math.min(speedSetpoint, speed + 50);
        } else {
            speed = Math.max(0, speed - 100);
        }
        
        unit.inputRegisters.writeUInt16BE(speed, 206);
        unit.inputRegisters.listener.emit('change:103', speed);
    }, 200);
}

module.exports = setUnitToData;
