// @ts-check
'use strict';

/**
 * @enum {number}
 */
const FunctionCode = {
  ReadDiscreteInputs: 0x02,
  ReadCoils: 0x01,
  WriteSingleCoil: 0x05,
  WriteMultipleCoils: 0x0F,
  ReadInputRegisters: 0x04,
  ReadHoldingRegisters: 0x03,
  WriteSingleRegister: 0x06,
  WriteMultipleRegisters: 0x10,
  ReadWriteMultipleRegisters: 0x17,
  MaskWriteRegister: 0x16,
  ReadFifoQueue: 0x18,
  ReadFileRecord: 0x14,
  WriteFileRecord: 0x15,
  ReadExceptionStatus: 0x07,
  Diagnostic: 0x08,
  GetComEventCounter: 0x0B,
  GetComEventLog: 0x0C,
  ReportServerId: 0x11,
  ReadDeviceIdentification: 0x2B,
  Exception: 0x80
};

/**
 * @type {{ master: { interval: any; timeout: any; addressingoffset: any; requests: any[]; unit_id: number; }; mqtt: { debug: any; }; }}
 */
const config = require('./config').default.config;
const util = require('../utils/modbus_data_tools');

const INTERVAL = (config.master.interval && typeof config.master.interval === 'number') ? config.master.interval : 1000;//polling delay in ms
const MAXRETRIES = 10;
const TIMEOUT = (config.master.timeout && typeof config.master.timeout === 'number') ? config.master.timeout : 500;//polling delay in ms

//states used to update master connexion errors and last values
const mqtt_lastvalue = {};
const modbus_lastvalue = {};
let mqtt_alerted = false;
const readWrite_timeouts = new Map();
const requests_params = new Map();

/**
 * @typedef {Object} ModbusParams
 * @property {number} interval
 * @property {number} timeout
 * @property {number} unit_id
 * @property {string} nodeName
 * @property {number} readCode
 * @property {number} [start_address]
 * @property {number} [qte]
 * @property {Object.<string, any>} [properties]
 * @property {number} [write_start_address]
 * @property {number} [write_qte]
 * @property {Object.<string, any>} [write_properties]
 */

/**
 * @typedef {Object} ModbusResponse
 * @property {number} functionCode
 * @property {number} [exceptionCode]
 * @property {boolean[]|Buffer} [states]
 * @property {Buffer} [data]
 */

/**
 * @typedef {Object} TransactionRequest
 * @property {number} functionCode
 * @property {number} startingAddress
 * @property {number} quantity
 */

/**
 * @typedef {Object} WriteRequest
 * @property {number} functionCode
 * @property {number} [address]
 * @property {number} [startingAddress]
 * @property {boolean} [state]
 * @property {number} [value]
 * @property {boolean[]|Buffer} [states]
 * @property {Buffer} [values]
 */

/**
 * @param {any} master
 * @param {any} mqttclient
 * @returns {void}
 */
function setRequest(master, mqttclient) {
  const ADR_OFFSET = config.master.addressingoffset && config.master.addressingoffset && typeof config.master.addressingoffset === 'number' ? config.master.addressingoffset : 0;
  const REGISTERY_READ = {
    "DI": {
      "readmultiple": FunctionCode.ReadDiscreteInputs,
      "readsingle": FunctionCode.ReadDiscreteInputs
    },
    "DO": {
      "readmultiple": FunctionCode.ReadCoils,
      "readsingle": FunctionCode.ReadCoils
    },
    "AI": {
      "readmultiple": FunctionCode.ReadInputRegisters,
      "readsingle": FunctionCode.ReadInputRegisters
    },
    "AO": {
      "readmultiple": FunctionCode.ReadHoldingRegisters,
      "readsingle": FunctionCode.ReadHoldingRegisters,
      "readwrite": FunctionCode.ReadWriteMultipleRegisters
    }
  }

  const REGISTERY_WRITE = {
    "DO": (m) => (m) ? FunctionCode.WriteMultipleCoils : FunctionCode.WriteSingleCoil,
    "AO": (m) => (m) ? FunctionCode.WriteMultipleRegisters : FunctionCode.WriteSingleRegister
  }
  const REGISTERY_LABEL = {
    "DI": (unitid, r_lib) => `Request ${r_lib} on unit ${unitid} : Digital Inputs`,
    "DO": (unitid, r_lib) => `Request ${r_lib} on unit ${unitid} : Coils`,
    "AI": (unitid, r_lib) => `Request ${r_lib} on unit ${unitid} : Input Register`,
    "AO": (unitid, r_lib) => `Request ${r_lib} on unit ${unitid} : Holding Register`
  }

  if (config.mqtt) {
    //déclaration des noeuds et propriétés Homie MQTT
    forEachModbusRequestFunctionDesc((request_n, key, r_key, unit_id) => {
      const request = config.master.requests[request_n];
      const diff_write = request.ModbusRequestType === "readwrite" && request.writedata
      createNode(
        request_n,
        nodeName(key, request_n),
        REGISTERY_LABEL[r_key](unit_id, request.label + ((diff_write) ? ' readings' : '')),
        request.data[key],
        REGISTERY_READ[r_key][request.ModbusRequestType || 'readmultiple'],
        (diff_write) ? null : REGISTERY_WRITE[r_key],
        unit_id,
        key);
      if (diff_write) {
        createNode(
          request_n,
          nodeName(key, request_n) + '-W',
          REGISTERY_LABEL[r_key](unit_id, request.label + ' writings'),
          request.writedata[key],
          REGISTERY_READ[r_key][request.ModbusRequestType || 'readmultiple'],
          REGISTERY_WRITE[r_key],
          unit_id,
          key);
      }
    });
    mqttclient.setup();

    //Mise à jour des valeurs MQTT en fonction des trames recues
    forEachModbusRequestFunctionDesc((request_n, key, r_key, unit_id) =>
      initTransactions(request_n, key, REGISTERY_READ[r_key], unit_id)
    );

    master.master.on('error', () => {
      forEachModbusRequestFunctionDesc((request_n, key/*, r_key, unit_id*/) =>
        Object.keys(config.master.requests[request_n].data[key]).forEach(prop => undefineNodeKeyValue(nodeName(key, request_n), prop, config.master.requests[request_n].data[key][prop]))
      );
    })

    //logs
    if (config.mqtt.debug) {
      mqttclient.on('message', function (topic, value) {
        console.log('MQTT message arrived on topic: ' + topic + ' with value: ' + value);
      });
    }
  }

  /**
   * Iteration pour chaque fonction modbus et chaque Unit Id décrit dans config.master.requests
   * @param {(request_n: number, key: string, r_key: string, r_id: number) => void} callback
   */
  function forEachModbusRequestFunctionDesc(callback) {
    config.master.requests.forEach((request) => {
      Object.keys(request.data).forEach(key => {
        const r_key = key.substring(0, 2);
        if (REGISTERY_READ[r_key]) { //vérification présence de la config
          let r_id = key.substring(2);
          let uintr_id = 0;
          if (r_id.substring(0, 1) === '#') {
            uintr_id = parseInt(key.replace(/[^0-9\.]/g, ''), 10);
            if (uintr_id > 0xFF) {
              throw new Error(`Unit ID ${uintr_id} not inplemented in Modbus Simulator.`)
            }
          }
          else {
            if (r_id === "") {
              uintr_id = (config.master.unit_id && typeof config.master.unit_id === 'number') ? config.master.unit_id : 0x01; //Par défaut le client répondra sur le Unit ID 1
            }
            else {
              throw new Error(`Unexpected paramter ${key} : 'AA#number' or 'AA' expected`);
            }
          }
          //vérification de la présence de la clé dans request.writedata
          if (request.ModbusRequestType === "readwrite" && request.writedata && !request.writedata[key]) {
            throw new Error(`Parameter ${key} read in data but absent from writedata`);
          }
          callback(config.master.requests.indexOf(request), key, r_key, uintr_id);
        }
      });
    });
  }

  /**
  * update propertie value according to request response and according to it's type
  * @param {string} nodename
  * @param {string} key
  * @param {any} entry 
  * @param {any} value
  * @returns {void}
  */
  function updateNodeKeyValue(nodename, key, entry, value) {
    util.getValueFromRegistery(entry, value, (v) => {
      if (mqtt_lastvalue[`${nodename}.${key}`] !== v) {
        mqttclient.nodes[nodename.replace('#', '-')].setProperty(key).setRetained(true)
          .send((entry.encodeInt) ? v.toString(entry.encodeInt) : v.toString());
        mqtt_lastvalue[`${nodename}.${key}`] = v;
      }
    });

    if (mqtt_alerted && Object.keys(mqtt_lastvalue).findIndex((e) => mqtt_lastvalue[e] === undefined) < 0) //si plus aucunne valeur en erreur de reception, lever l'alerte
    {
      mqttclient.mqttClient.publish(mqttclient.mqttTopic + '/$state', 'ready');
      mqtt_alerted = false;
    }
  }

  /**
   * undefine propertie value in case of bad request response
   * @param {string} nodename
   * @param {string} key
   * @param {any} entry 
   * @returns {void}
   */
  function undefineNodeKeyValue(nodename, key, entry) {
    if (mqtt_lastvalue[`${nodename}.${key}`] !== undefined) {
      mqttclient.nodes[nodename.replace('#', '-')].setProperty(key).setRetained(true).send(null);
      mqtt_lastvalue[`${nodename}.${key}`] = undefined;
      if (entry.type === 'boolean') {
        mqttclient.mqttClient.publish(`${mqttclient.mqttTopic}/${nodename}/${key}/$indeterminate`, 'true');
      }
    }
    if (!mqtt_alerted) {
      mqtt_alerted = true;
      mqttclient.mqttClient.publish(mqttclient.mqttTopic + '/$state', 'alert');
    }
  }

  /**
   * Create Homie MQTT Node
   * @param {number} request_n
   * @param {string} node_key
   * @param {string} label 
   * @param {any} entries 
   * @param {number} readCode
   * @param {((m: boolean) => number)|null} writeCode
   * @param {number} unit_id used in case of settable data
   * @param {string} key
   * @returns {void}
   */
  function createNode(request_n, node_key, label, entries, readCode, writeCode, unit_id, key) {
    const node = mqttclient.node(node_key.replace('#', '-'), label, 'test-node');
    if (readCode === FunctionCode.ReadCoils || readCode === FunctionCode.ReadDiscreteInputs) {
      Object.keys(entries).forEach(prop => {
        node.advertise(prop).setName(entries[prop].label).setDatatype('boolean');
        if (writeCode) {
          node.setProperty(prop).settable(function (range, value) {
            const setValue = (typeof value === 'boolean') ? value : (typeof value === 'string' && value === 'false') ? false : true;
            sendToModbus(prop, setValue, request_n, key, unit_id, writeCode,
              () => node.setProperty(prop).setRetained(true).send(setValue.toString())
            );
          })
        }
      });
    }
    else if (readCode === FunctionCode.ReadInputRegisters || readCode === FunctionCode.ReadHoldingRegisters || readCode === FunctionCode.ReadWriteMultipleRegisters) {
      Object.keys(entries).forEach(prop => {
        util.CheckOffsetReadWriteProperties(entries[prop]);

        node.advertise(prop).setName(entries[prop].label).setDatatype(entries[prop].type);
        if (writeCode) {
          node.setProperty(prop).settable(function (range, value) {
            sendToModbus(prop, value, request_n, key, unit_id, writeCode,
              () => node.setProperty(prop).setRetained(true).send(value.toString())
            );
          })
        }
      });
    }
  }

  /**
   * create a new Modbus transaction and set callbacks to update HMI
   * @param {string} id transaction id 
   * @param {ModbusParams} [params] optional but required if not already set
   * @returns {void}
   */
  function setTransaction(id, params) {
    const t = readWrite_timeouts.get(id)
    if (t) {
      clearTimeout(t);
    }
    if (!params) { params = requests_params.get(id); }
    else { requests_params.set(id, params); }

    let transaction = null;
    if (params.readCode === FunctionCode.ReadWriteMultipleRegisters) {
      //Init saved values before first readwrite request
      if (!modbus_lastvalue[id + '-W']) { modbus_lastvalue[id + '-W'] = Buffer.alloc(params.write_qte * 2); }
      transaction = master.master.readWriteMultipleRegisters(
        params.start_address,
        params.qte,
        params.write_start_address || params.start_address,
        modbus_lastvalue[id + '-W'],
        { unit: params.unit_id, timeout: params.timeout, maxRetries: MAXRETRIES });
    } else {
      const transaction_request = {
        functionCode: params.readCode,
        startingAddress: params.start_address,
        quantity: params.qte
      };
      transaction = master.createTransaction({ id: id, unit: params.unit_id, request: transaction_request, interval: params.interval, timeout: params.timeout, maxRetries: MAXRETRIES });
    }

    const success = (res) => {
      if (!res.exceptionCode) {
        if (params.readCode === res.functionCode) {
          let val = res.states ? res.states : res.data;
          //Coils are always returned by 8 or multiples
          if (params.readCode === FunctionCode.ReadCoils && params.qte === 1) {
            val = val[0]
          }
          modbus_lastvalue[id] = val;
          Object.keys(params.properties).forEach(prop =>
            updateNodeKeyValue(params.nodeName, prop, params.properties[prop], getResponseData(val, prop, params.properties[prop], params.start_address))
          )
        }
        else { throw new Error(`Unexpected Modbus response code ${res.functionCode}. ${params.readCode} was expected`) }
      }
      else {
        Object.keys(params.properties).forEach(prop => undefineNodeKeyValue(params.nodeName, prop, params.properties[prop]));
        //init cache in order to process write modifications
        if (!modbus_lastvalue[id]) {
          if (params.readCode === FunctionCode.ReadCoils || params.reandCode === FunctionCode.ReadDiscreteInputs) {
            modbus_lastvalue[id] = new Array(params.qte);
          }
          else {
            modbus_lastvalue[id] = Buffer.alloc(params.qte*2);
          }
        }
      }
    };

    transaction.on('error', () => Object.keys(params.properties).forEach(prop => undefineNodeKeyValue(params.nodeName, prop, params.properties[prop])));
    if (params.readCode === FunctionCode.ReadWriteMultipleRegisters) {
      transaction.once('response', success);
      //If readwrite, we create a loop to launch new transaction after poll delay
      transaction.once('complete', () => {
        readWrite_timeouts.set(id, setTimeout(() => setTransaction(id), params.interval))
      })
    } else {
      transaction.on('response', success);
    }
  }

  /**
   * Read value from Response
   * @param {Buffer|boolean[]|boolean|number} values
   * @param {string} prop Property name
   * @param {any} entry property configuration 
   * @param {number} start_address 
   * @returns {number|boolean} value UInt16BE for registers or boolean for coils
   */
  function getResponseData(values, prop, entry, start_address) {
    let value = null
    if (typeof values === 'boolean' || typeof values === 'number') { value = values; }
    else if (Array.isArray(values) && typeof values[0] === 'boolean') {
      value = values[util.getRegisterAddress(prop, entry.address, ADR_OFFSET) - start_address];
    }
    else if (Buffer.isBuffer(values)) {
      if (values.length === 2) {
        value = values.readUInt16BE(); //Contains only one register 
      } else {
        const responseBufferAddress = util.getBufferAddress(prop, entry.address, start_address + ADR_OFFSET);
        //on retourne le registre complet soit 2 octets
        value = values.slice(responseBufferAddress, responseBufferAddress + 2).readUInt16BE();
      }
    }
    return value;
  }

  /**
   * set modbus periodic transactions and send values to MQTT
   * @param {number} request_n request number
   * @param {string} key registery key
   * @param {Object.<string, number>} readCode 
   * @param {number} unit_id
   * @returns {void}
   */
  function initTransactions(request_n, key, readCode, unit_id) {
    const request = config.master.requests[request_n];
    const nd_cfg = request.data[key];
    //replace null by default value
    if (!request.ModbusRequestType) { request.ModbusRequestType = "readmultiple"; }
    if (!readCode[request.ModbusRequestType]) {
      throw new Error(`${request.ModbusRequestType} is not available for ${key}`);
    }
    const id = `R${request_n}_${key}`;

    const params = {
      interval: (request.interval && typeof request.interval === 'number') ? request.interval : INTERVAL,
      timeout: (request.timeout && typeof request.timeout === 'number') ? request.timeout : TIMEOUT,
      unit_id: unit_id,
      nodeName: nodeName(key, request_n),
      readCode: readCode[request.ModbusRequestType]
    }
    if (request.ModbusRequestType === "readsingle") {
      Object.keys(request.data[key]).forEach(prop => {
        const param = Object.assign({
          start_address: util.getRegisterAddress(prop, nd_cfg[prop].address, ADR_OFFSET),
          qte: 1,
          properties: { [prop]: nd_cfg[prop] }
        }, params);
        setTransaction(`${id}_${prop}`, param);
      });
    }
    else {
      const prprts = sortPropertiesByAddress(nd_cfg);
      let param = Object.assign({
        start_address: util.getRegisterAddress(prprts[0], nd_cfg[prprts[0]].address, ADR_OFFSET),
        qte: getQte(prprts, nd_cfg),
        properties: nd_cfg
      }, params);
      if (request.writedata) {
        const write_prprts = sortPropertiesByAddress(request.writedata[key]);
        param = Object.assign(param, {
          write_start_address: util.getRegisterAddress(write_prprts[0], request.writedata[key][write_prprts[0]].address, ADR_OFFSET),
          write_qte: getQte(write_prprts, request.writedata[key]),
          write_properties: request.writedata[key]
        })
      }
      setTransaction(id, param);
    }

    /**
     * @param {string[]} prprts
     * @param {Object.<string, any>} cfg
     * @returns {number}
     */
    function getQte(prprts, cfg) {
      return util.getRegisterAddress(prprts[prprts.length - 1], cfg[prprts[prprts.length - 1]].address)
        - util.getRegisterAddress(prprts[0], cfg[prprts[0]].address) + 1;
    }

    /**
     * @param {Object.<string, any>} data
     * @returns {string[]}
     */
    function sortPropertiesByAddress(data) {
      return Object.keys(data).sort((a, b) => util.getRegisterAddress(a, data[a].address) - util.getRegisterAddress(b, data[b].address));
    }
  }

  /**
   * Distant coils/register writing (DO-AO) 
   * @param {string} prop property name 
   * @param {any} value
   * @param {number} request_n request number
   * @param {string} key (AO#1 DO)
   * @param {number} unit_id 
   * @param {(b: boolean) => number} writeCode
   * @param {() => void} callback
   * @returns {void}
   */
  function sendToModbus(prop, value, request_n, key, unit_id, writeCode, callback) {
    const isCoil = writeCode(false) === FunctionCode.WriteSingleCoil;
    let t_id = `R${request_n}_${key}`;
    let params = requests_params.get(t_id);
    if (!params) {
      t_id = `${t_id}_${prop}`;
      params = requests_params.get(t_id);
    }
    const id = (params.write_start_address) ? t_id + '-W' : t_id;
    const entry = (params.write_properties) ? params.write_properties[prop] : params.properties[prop];
    const start_address = params.write_start_address || params.start_address;
    const transactionregister_address = (util.getRegisterAddress(prop, entry.address) - start_address)
    const transactionBuffer_address = util.getBufferAddress(prop, entry.address, start_address + ADR_OFFSET, entry.offset);

    //Detect if change is necessary
    let oldv = null;
    const tmp = getResponseData(modbus_lastvalue[id], prop, entry, start_address);
    util.getValueFromRegistery(entry, tmp, (v) => oldv = v);

    if (oldv !== null && value === oldv.toString()) { callback(); }
    else {
      /**we will save updated data to
       * -write them by modbus at next read write request
       * -take care of all values of the register containg propertie data
       */
      if (typeof modbus_lastvalue[id] === 'boolean') {
        modbus_lastvalue[id] = value;
      }
      else if (Array.isArray(modbus_lastvalue[id]) && typeof modbus_lastvalue[id][0] === 'boolean') {
        modbus_lastvalue[id][transactionregister_address] = value;
      }
      else {
        if (typeof modbus_lastvalue[id] === 'number') {
          const tmp = Buffer.alloc(2);
          tmp.writeUInt16BE(modbus_lastvalue[id]);
          util.writeToRegister(entry, value, tmp, transactionBuffer_address)
          modbus_lastvalue[id] = tmp.readUInt16BE(0);
        }
        else {
          util.writeToRegister(entry, value, modbus_lastvalue[id], transactionBuffer_address);
        }
      }
      if (params.readCode !== FunctionCode.ReadWriteMultipleRegisters) {
        //sending write request if ther is no read write request
        try {
          const single = params.qte === 1;
          const write_request = {
            functionCode: writeCode(!single)
          };
          if (single) {
            write_request.address = params.start_address;
            if (isCoil) { write_request.state = modbus_lastvalue[id]; }
            else { write_request.value = modbus_lastvalue[id].readUInt16BE(); }
          }
          else {
            write_request.startingAddress = params.start_address
            if (isCoil) {
              write_request.states = modbus_lastvalue[id];
            }
            else {
              write_request.values = modbus_lastvalue[id];
            }
          }
          const transaction = master.master.request(write_request, {
            unit: params.unit_id
          });

          transaction.on('error', (err) => console.log(`${id}(${FunctionCode[write_request.functionCode]}):  ${err.message}`));
          transaction.on('response', (res) => {
            if (!res.exceptionCode) {
              callback();
            }
          });
        }
        catch (err) {
          console.log(`${t_id}(writeToRegister): ${err.message}`);
        }
      }
      else {
        setTransaction(t_id);
        callback();
      }
    }
  }
}

module.exports = setRequest;

/**
 * Compute node name
 * @param {string} key modbus key
 * @param {number} request_n request number
 * @returns {string} node name according to modbus key(function and unit id) and request number
 */
function nodeName(key, request_n) {
  return `R${request_n}-${key}`;
}