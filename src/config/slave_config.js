// @ts-check
'use strict'

const config = require('./config').config;
const Slave = require('../core/slave');
const util = require('../utils/modbus_data_tools');

function setUnitToData(unittodata, mqttclient) {
    const ADR_OFFSET = config.slave.addressingoffset && config.slave.addressingoffset && typeof config.slave.addressingoffset === 'number' ? config.slave.addressingoffset : 0;
    const REGISTERY_NAME = {
        "DI": (unitid) => unittodata[unitid].discreteInputs,
        "DO": (unitid) => unittodata[unitid].coils,
        "AI": (unitid) => unittodata[unitid].inputRegisters,
        "AO": (unitid) => unittodata[unitid].holdingRegisters
    }
    const REGISTERY_LABEL = {
        "DI": (unitid) => `Unit ${unitid} : Digital Inputs`,
        "DO": (unitid) => `Unit ${unitid} : Coils`,
        "AI": (unitid) => `Unit ${unitid} : Input Register`,
        "AO": (unitid) => `Unit ${unitid} : Holding Register`
    }

    if (config.mqtt) {
        //déclaration des noeuds et propriétés Homie MQTT
        forEachModbusFunctionDesc((key, r_key, unit_id) =>
            createNode(
                key,
                REGISTERY_LABEL[r_key](unit_id),
                config.slave.data[key],
                REGISTERY_NAME[r_key](unit_id))
        );
        mqttclient.setup();
        //Mise à jour des valeurs MQTT en fonction de l'existant
        forEachModbusFunctionDesc((key, r_key, unit_id) =>
            updateNodeValues(key, config.slave.data[key], REGISTERY_NAME[r_key](unit_id))
        );

        //logs
        if (config.mqtt.debug) {
            mqttclient.on('message', function (topic, value) {
                console.log('MQTT message arrived on topic: ' + topic + ' with value: ' + value);
            });
        }
    }
    //initialisation avec les valeurs par défaut
    forEachModbusFunctionDesc((key, r_key, unit_id) =>
        initRegister(config.slave.data[key], REGISTERY_NAME[r_key](unit_id))
    );

    /**
     * Iteration pour chaque fonction modbus et chaque Unit Id décrit dans config.slave
     * @param {*} callback (key, r_key, r_id)
     */
    function forEachModbusFunctionDesc(callback) {
        Object.keys(config.slave.data).forEach(key => {
            const r_key = key.substring(0, 2);
            let r_id_n = 0x01; //Par défaut le client répondra sur le Unit ID 1
            if (REGISTERY_NAME[r_key]) { //vérification présence de la config
                const r_id = key.substring(2);
                if (r_id.substring(0, 1) === '#') {
                    r_id_n = parseInt(key.replace(/[^0-9\.]/g, ''), 10);
                    if (r_id_n > 0xFF) {
                        throw new Error(`Unit ID ${r_id} not inplemented in Modbus Simulator.`)
                    }
                }
                else {
                    if (r_id !== "") {
                        throw new Error(`Unexpected paramter ${key} : 'AA#number' or 'AA' expected`);
                    }
                }
                if (!unittodata[r_id_n]) {
                    Slave.prototype.initUnitToData(unittodata, r_id_n)
                }
                callback(key, r_key, r_id_n);
            }
        });
    }

    /**
 * update properties values according to register changes and according to it's type
 * @param {string} nodename
 * @param {*} entries 
 * @param {Uint8Array|Buffer} register (array or buffer)
 */
    function updateNodeValues(nodename, entries, register) {
        Object.keys(entries).forEach(key => {
            /** @type {any} */ (register).listener.on('change:' + util.getRegisterAddress(key, entries[key].address, ADR_OFFSET), function (value) {
                util.getValueFromRegistery(entries[key], value, (v) =>
                    mqttclient.nodes[nodename.replace('#', '-')].setProperty(key).setRetained(true).send(v.toString())
                );
            });
        });
    }

    /**
     * initialise entries values in register according to it's type
     * @param {*} entries 
     * @param {Uint8Array|Buffer} register (array or buffer)
     */
    function initRegister(entries, register) {
        if (Array.isArray(register)) {
            Object.keys(entries).forEach(key => {
                const address = util.getRegisterAddress(key, entries[key].address, ADR_OFFSET);
                let value = false;
                if (entries[key].default && typeof entries[key].default === "boolean") {
                    value = entries[key].default;
                    util.setBit(register, address, entries[key].default);
                }
                /** @type {any} */ (register).listener.emit('change:' + address, value);
            });
        }
        else if (Buffer.isBuffer(register)) {
            const addresschanged = [];
            Object.keys(entries).forEach(key => {
                let buf_address = util.getBufferAddress(key, entries[key].address, ADR_OFFSET, entries[key].offset);
                const modbus_address = util.getRegisterAddress(key, entries[key].address, ADR_OFFSET);
                if (entries[key].default) {
                    util.writeToRegister(entries[key], entries[key].default, register, buf_address);
                }
                if (addresschanged.findIndex(a => a.modbus === modbus_address) < 0
                    && (
                        entries[key].default // valeur changée quel que soit le type
                        || entries[key].type === 'boolean')) //présence d'un booleen -> forcer le chargement de la valeur 'false'
                {
                    buf_address = util.getBufferAddress(key, entries[key].address, ADR_OFFSET,0);//sans offset pour retourner un registre complet
                    addresschanged.push({ modbus: modbus_address, buffer: buf_address });
                }
            });
            //On effectue qu'à la fin en cas de changements multiples sur un même registre
            addresschanged.forEach(a => {
                //ici on émet sur l'adresse modbus la valeur du registre complet, à l'identique de ce que fait slave.js dans le cas d'un changement par un slave modbus
                /** @type {any} */ (register).listener.emit('change:' + a.modbus, register.slice(a.buffer, a.buffer + 2).readUInt16BE());
            });
        }
    }

    /**
     * Create Homie MQTT Node
     * @param {*} id 
     * @param {*} label 
     * @param {*} entries 
     * @param {Uint8Array|Buffer} register (array or buffer)
     */
    function createNode(id, label, entries, register) {
        const node = mqttclient.node(id.replace('#', '-'), label, 'test-node');
        if (Array.isArray(register)) {
            Object.keys(entries).forEach(key => {
                node.advertise(key).setName(entries[key].libelle).setDatatype('boolean').settable(function (range, value) {
                    const setValue = (typeof value === 'boolean') ? value : (typeof value === 'string' && value === 'false') ? false : true;
                    node.setProperty(key).setRetained(true).send(setValue.toString());
                    util.setBit(register, util.getRegisterAddress(key, entries[key].address, ADR_OFFSET), setValue);
                });
            });
        }
        else if (Buffer.isBuffer(register)) {
            Object.keys(entries).forEach(key => {
                util.CheckOffsetReadWriteProperties(entries[key]);

                const buf_address = util.getBufferAddress(key, entries[key].address, ADR_OFFSET, entries[key].offset);
                node.advertise(key).setName(entries[key].libelle).setDatatype(entries[key].type).settable(function (range, value) {
                    node.setProperty(key).setRetained(true).send(value.toString());
                    //valeur binaire
                    util.writeToRegister(entries[key], value, register, buf_address);
                });
            });
        }
    }

}

module.exports = setUnitToData;