// @ts-check
// Part of <http://miracle.systems/p/modbus-master> licensed under <MIT>

'use strict';

const stats = require('./stats');
const modbus = require('h5.modbus');
const events = require('events');
const ExceptionCode = modbus.ExceptionCode;
const FunctionCode = modbus.FunctionCode;
const MAX_BUFFER_OVERFLOWS = Number.MAX_SAFE_INTEGER;
const FUNCTION_CODE_TO_DATA_PROPERTY = {
  [FunctionCode.ReadCoils]: 'coils',
  [FunctionCode.ReadDiscreteInputs]: 'discreteInputs',
  [FunctionCode.ReadHoldingRegisters]: 'holdingRegisters',
  [FunctionCode.ReadInputRegisters]: 'inputRegisters',
  [FunctionCode.WriteSingleCoil]: 'coils',
  [FunctionCode.WriteSingleRegister]: 'holdingRegisters',
  [FunctionCode.WriteMultipleCoils]: 'coils',
  [FunctionCode.WriteMultipleRegisters]: 'holdingRegisters',
  [FunctionCode.ReadWriteMultipleRegisters]: 'holdingRegisters'
};

/**
 * Set a bit at position on Uint8Array
 * @param {Uint8Array} array
 * @param {number} bitAddress
 * @param {boolean} state
 */
function setBit(array, bitAddress, state) {
  if (state === false) {
    array[Math.floor(bitAddress / 8)] &= ~(1 << bitAddress % 8);
  } else {
    array[Math.floor(bitAddress / 8)] |= (1 << bitAddress % 8);
  }
  array.listener.emit('change:' + bitAddress % 10000, state);
}


/**
 * Slave implementation of modbus tcp-udp simulator
 */
class SlaveSimulator {

  constructor(options) {
    this.DEBUG = options.debug;
    this.STATS = options.stats;
    this.DELAY = options.delay;
    let clientCounter = 0;
    this.clientIdMap = new Map();
    this.clientOverflowMap = new Map();
    this.transport = this.setUpTransport(options);

    //On initialise l'objet vide. Il sera complété à l'usage en fonction des Unit Id Modbus utilisés par l'appel de initUnitToData
    this.UNIT_TO_DATA= {};
    // initUnitToData(this.UNIT_TO_DATA,0x01);

    this.listener = this.setUpListener(options);

    if (this.DEBUG) {
      this.listener.on('open', () => console.log('listener#open'));
      this.listener.on('close', () => console.log('listener#close'));
    }
    this.listener.on('error', (err) => console.log('listener#error: %s', err.message));
    if (this.STATS) {
      this.listener.once('client', () => setInterval(stats.show.bind(stats), 1000));
    }

    this.listener.on('client', function (client) {
      if (this.STATS) {
        stats.reset();
      }

      const clientAddress = client.remoteInfo.address;

      if (this.clientOverflowMap.get(clientAddress) > MAX_BUFFER_OVERFLOWS) {
        setTimeout(() => this.clientOverflowMap.delete(clientAddress), 10000);

        client.destroy();

        return;
      }

      const clientId = ++clientCounter;

      this.clientIdMap.set(client, clientId);

      if (this.DEBUG) {
        console.log('listener#client: %d', clientId);
        client.on('close', () => console.log('client#%d#close', clientId));
        client.on('data', data => console.log('client#%d#data:', clientId, data));
        client.on('write', data => console.log('client#%d#write:', clientId, data));
      }

      client.on('bufferOverflow', function (buffer) {
        const count = (this.clientOverflowMap.get(clientAddress) || 0) + 1;

        console.log('client#%d#bufferOverflow: count=%d length=%d', clientId, count, buffer.length);

        this.clientOverflowMap.set(clientAddress, count);

        if (count > this.MAX_BUFFER_OVERFLOWS) {
          setTimeout(() => this.clientOverflowMap.delete(clientAddress), 10000);

          client.destroy();
        }
      });
    }.bind(this));

    this.slave = new modbus.Slave({
      listener: this.listener,
      transport: this.transport,
      requestHandler: this.handleRequest.bind(this)
    });

    if (global.gc) {
      setInterval(global.gc, 60000);
    }

    this.slave.on('request', function (e) {
      if (this.DEBUG) {
        console.log(`slave#request#${this.clientIdMap.get(e.client)}#${e.adu.unit}#${e.adu.id || 0}: ${e.request}`);
      }
      ++stats.req;
    }.bind(this));

    this.slave.on('response', function (e) {
      if (this.DEBUG) {
        console.log(`slave#response#${this.clientIdMap.get(e.client)}#${e.adu.unit}: ${e.response}`);
      }
      ++stats.req;
    }.bind(this));

    this.FUNCTION_CODE_TO_DATA_HANDLER = {
      [FunctionCode.ReadCoils]: this.handleReadCoilsRequest.bind(this),
      [FunctionCode.ReadDiscreteInputs]: this.handleReadDiscreteInputsRequest.bind(this),
      [FunctionCode.ReadHoldingRegisters]: this.handleReadHoldingRegistersRequest.bind(this),
      [FunctionCode.ReadInputRegisters]: this.handleReadInputRegistersRequest.bind(this),
      [FunctionCode.WriteSingleCoil]: this.handleWriteSingleCoilRequest.bind(this),
      [FunctionCode.WriteSingleRegister]: this.handleWriteSingleRegisterRequest.bind(this),
      [FunctionCode.WriteMultipleCoils]: this.handleWriteMultipleCoilsRequest.bind(this),
      [FunctionCode.WriteMultipleRegisters]: this.handleWriteMultipleRegistersRequest.bind(this),
      [FunctionCode.ReadWriteMultipleRegisters]: this.handleReadWriteMultipleRegistersRequest.bind(this)
    }
  }

  /**
   * Parametrer le transport
   * @param {*} options 
   * @returns {*} parametered transport according to options
   */
  setUpTransport(options) {
    switch (options.type){
      case 'serial-ascii':
        return new modbus.AsciiTransport({});
      case 'serial-rtu':
        return new modbus.RtuTransport({});
      default:
        return new modbus.IpTransport({});
    }
  }

  /**
   * Set up listener according to options
   * @param {*} options 
   * @returns {*} listener
   */
  setUpListener(options) {
    let listener = null;
    switch (options.type) {
      case 'udp':
        listener = new modbus.UdpListener({ socketOptions: options.serverOptions });
        break;
      case 'tcp':
        listener = new modbus.TcpListener({ serverOptions: options.serverOptions });
        break;
      case 'serial-ascii':
      case 'serial-rtu':
        listener = new modbus.SerialListener({
          path: options.path,
          serialPortOptions: options.serialPortOptions
        });
        break;
      default:
        throw new Error("type must be 'udp', 'tcp', 'serial-ascii' or 'serial-rtu'");
    }
    return listener;
  }




  /**
   * @param {number} unit
   * @param {import('h5.modbus/lib/Request')} request
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleRequest(unit, request, respond) {
    const unitData = this.UNIT_TO_DATA[unit];

    if (unitData) {
      this.handleUnitRequest(unit, request, unitData, function (result) {
        if (this && typeof this === 'number') {
          setTimeout(respond, this, result);
        }
        else {
          respond(result);
        }
      }.bind(this.DELAY));
    }
    else {
      respond(ExceptionCode.IllegalDataAddress);
    }
  }

  /**
   * @param {number} unit
   * @param {import('h5.modbus/lib/Request')} request
   * @param {UnitData} unitData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleUnitRequest(unit, request, unitData, respond) {
    if (FUNCTION_CODE_TO_DATA_PROPERTY[request.functionCode]) {
      this.handleReadWriteRequest(unit, request, unitData, respond);
    }
    else {
      this.handleCommandRequest(unit, request, unitData, respond);
    }
  }

  /**
   * @param {number} unit
   * @param {import('h5.modbus/lib/Request')} request
   * @param {UnitData} unitData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleCommandRequest(unit, request, unitData, respond) {
    respond(ExceptionCode.IllegalFunctionCode);
  }

  /**
   * @param {number} unit
   * @param {import('h5.modbus/lib/Request')} request
   * @param {UnitData} unitData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadWriteRequest(unit, request, unitData, respond) {
    const functionData = unitData[FUNCTION_CODE_TO_DATA_PROPERTY[request.functionCode]] || null;

    if (functionData === null) {
      respond(ExceptionCode.IllegalFunctionCode);
    }
    else {
      this.FUNCTION_CODE_TO_DATA_HANDLER[request.functionCode](unit, request, functionData, respond);
    }
  }

  /**
   * @param {(modbus.ReadCoilsRequest|modbus.ReadDiscreteInputsRequest)} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadStatesRequest(request, functionData, respond) {
    this.handleReadBufferRequest(
      functionData,
      b => { 
        const result = modbus.helpers.toBitArray(b, 
          0, 
          (Math.floor(request.quantity / 8) + 1)*8 
          );
        result.splice(0,request.startingAddress % 8);
        return { states: result.splice(0,request.quantity) };
      },
      Math.floor(request.startingAddress / 8),
      Math.floor(request.endingAddress / 8) + 1,
      respond
    );
  }

  /**
   * @param {(modbus.ReadHoldingRegistersRequest|modbus.ReadInputRegistersRequest)} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadRegisterRequest(request, functionData, respond) {
    this.handleReadBufferRequest(
      functionData,
      b => { return { data: b }; },
      request.startingIndex,
      request.endingIndex,
      respond
    );
  }

  /**
   * @param {Buffer} functionData
   * @param {function(Buffer): Object} prepareResult
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadBufferRequest(functionData, prepareResult, startIndex, endIndex, respond) {
    if (startIndex >= functionData.length || endIndex > functionData.length) {
      respond(ExceptionCode.IllegalDataAddress);
    }
    else {
      respond(prepareResult(functionData.slice(startIndex, endIndex)));
    }
  }

  /**
   * @param {number} unit
   * @param {modbus.ReadCoilsRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadCoilsRequest(unit, request, functionData, respond) {
    this.handleReadStatesRequest(request, functionData, respond);
  }

  /**
   * @param {number} unit
   * @param {modbus.ReadDiscreteInputsRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadDiscreteInputsRequest(unit, request, functionData, respond) {
    this.handleReadStatesRequest(request, functionData, respond);
  }

  /**
   * @param {number} unit
   * @param {modbus.ReadHoldingRegistersRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadHoldingRegistersRequest(unit, request, functionData, respond) {
    this.handleReadRegisterRequest(request, functionData, respond);
  }

  /**
   * @param {number} unit
   * @param {modbus.ReadInputRegistersRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleReadInputRegistersRequest(unit, request, functionData, respond) {
    this.handleReadRegisterRequest(request, functionData, respond);
  }

  /**
   * @param {number} unit
   * @param {modbus.WriteSingleCoilRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  // eslint-disable-next-line no-unused-vars
  handleWriteSingleCoilRequest(unit, request, functionData, respond) {
    try {
      setBit(functionData, request.address, request.state);
      respond(request);
    }
    catch (err) {
      respond(ExceptionCode.IllegalDataAddress);
    }
  }

  /**
   * @param {number} unit
   * @param {modbus.WriteSingleRegisterRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleWriteSingleRegisterRequest(unit, request, functionData, respond) {
    try {
      functionData.writeUInt16BE(request.value, request.address * 2);
      functionData.listener.emit('change:' + request.address % 10000, request.value);
      respond(request);
    }
    catch (err) {
      respond(ExceptionCode.IllegalDataAddress);
    }
  }

  /**
   * @param {number} unit
   * @param {modbus.WriteMultipleCoilsRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleWriteMultipleCoilsRequest(unit, request, functionData, respond) {
    try {
      let bitArrayIndex = 0;
      for (request.startingAddress; bitArrayIndex < request.quantity; ++bitArrayIndex) {
        setBit(functionData, request.startingAddress + bitArrayIndex, request.states[bitArrayIndex]);
      }
      respond(request);
    }
    catch (err) {
      respond(ExceptionCode.IllegalDataAddress);
    }
  }

  /**
   * @param {number} unit
   * @param {modbus.WriteMultipleRegistersRequest} request
   * @param {Buffer} functionData
   * @param {import('h5.modbus/lib/Slave').respondCallback} respond
   */
  handleWriteMultipleRegistersRequest(unit, request, functionData, respond) {
    try {
      this.writeMultipleRegisters(request.values, request.startingAddress, functionData);
      respond(request);
    }
    catch (err) {
      respond(ExceptionCode.IllegalDataAddress);
    }
  }

  /**
   * Write values to functionData and emit event for each register
   * @param {Buffer} values 
   * @param {number} startingAddress 
   * @param {Buffer} functionData 
   */
  writeMultipleRegisters(values, startingAddress, functionData) {
    values.copy(functionData, startingAddress * 2);
    for (let i = 0; i < values.length / 2; i += 1) {
      functionData.listener.emit('change:' + (startingAddress + i) % 10000, values.slice(i * 2, (i + 1) * 2).readUInt16BE());
    }
  }

  /**
 * @param {number} unit
 * @param {modbus.ReadWriteMultipleRegistersRequest} request 
 * @param {Buffer} functionData 
 * @param {import('h5.modbus/lib/Slave').respondCallback} respond 
 */ 
handleReadWriteMultipleRegistersRequest(unit, request, functionData, respond) 
{ 
  try 
  { 
    this.writeMultipleRegisters(request.writeValues, request.writeStartingAddress, functionData);
  }
  catch (err)
  {
    respond(ExceptionCode.IllegalDataAddress);
    return;
  }
  this.handleReadBufferRequest(
    functionData,
    b => { return {data: b}; },
    request.readStartingIndex,
    request.readEndingIndex,
    respond
  );
}

  /**
   * Initialise les registres nécessaires pour un Unit Id Modbus
   * @param {*} UNIT_TO_DATA 
   * @param {*} unitid 
   */
  initUnitToData(UNIT_TO_DATA,unitid) {
    UNIT_TO_DATA[unitid] = {
      coils: new Array(0xFFFF),
      discreteInputs: new Array(0xFFFF),
      holdingRegisters: Buffer.alloc(0x10000 * 2).fill(0),
      inputRegisters: Buffer.alloc(0x10000 * 2).fill(0)
    };
    UNIT_TO_DATA[unitid].coils.listener = new events.EventEmitter().setMaxListeners(0xFFFF);
    UNIT_TO_DATA[unitid].discreteInputs.listener = new events.EventEmitter().setMaxListeners(0xFFFF);
    UNIT_TO_DATA[unitid].holdingRegisters.listener = new events.EventEmitter().setMaxListeners(0x10000);
    UNIT_TO_DATA[unitid].inputRegisters.listener = new events.EventEmitter().setMaxListeners(0x10000);
  }

  /**
   * @typedef {object} UnitData
   * @property {?Buffer} coils
   * @property {?Buffer} discreteInputs
   * @property {?Buffer} holdingRegisters
   * @property {?Buffer} inputRegisters
   */
}

module.exports = SlaveSimulator;
