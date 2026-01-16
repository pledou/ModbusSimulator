// @ts-check
'use strict'

/**
 * Custom error for values outside valid register range
 */
class OutOfRangeError extends Error {
  constructor(value, registerType, minValue, maxValue) {
    super(`Value ${value} is out of range for ${registerType} (valid: ${minValue} to ${maxValue})`);
    this.name = 'OutOfRangeError';
    this.value = value;
    this.registerType = registerType;
    this.minValue = minValue;
    this.maxValue = maxValue;
  }
}

/**
 * Get the valid range for a register type
 * @param {string} registerType - Buffer method name without 'write'/'read' prefix (e.g., 'Int16BE', 'UInt16BE')
 * @returns {{min: number, max: number}} Valid range for the register type
 */
function getRegisterRange(registerType) {
  const ranges = {
    'Int8': { min: -128, max: 127 },
    'UInt8': { min: 0, max: 255 },
    'Int16BE': { min: -32768, max: 32767 },
    'Int16LE': { min: -32768, max: 32767 },
    'UInt16BE': { min: 0, max: 65535 },
    'UInt16LE': { min: 0, max: 65535 },
    'Int32BE': { min: -2147483648, max: 2147483647 },
    'Int32LE': { min: -2147483648, max: 2147483647 },
    'UInt32BE': { min: 0, max: 4294967295 },
    'UInt32LE': { min: 0, max: 4294967295 },
  };
  return ranges[registerType] || null;
}

/**
 * Validate that a value is within the valid range for a register type
 * @param {number} value - The value to validate
 * @param {string} registerType - The register type (e.g., 'Int16BE', 'UInt16BE')
 * @throws {OutOfRangeError} If value is outside valid range
 */
function validateRegisterRange(value, registerType) {
  const range = getRegisterRange(registerType);
  if (!range) {
    // If register type is unknown, skip validation (trust Buffer methods to handle it)
    return;
  }
  
  if (value < range.min || value > range.max) {
    throw new OutOfRangeError(value, registerType, range.min, range.max);
  }
}

/**
* Ecriture en registre (AI-AO)
* @param {*} entry 
* @param {*} value 
* @param {Buffer} register Buffer to update
* @param {number} address buffer address (modbus*2)
*/
function writeToRegister(entry, value, register, address) {
    let setValue;
    switch (entry.type) { //Homie Convention type
        case "boolean":
            setValue = (typeof value === 'boolean') ? value : (typeof value === 'string' && value === 'false') ? false : true;
            setBitToBuffer(register, address, entry.offset, setValue);
            break;
        case "integer":
        case "string":
            setValue = parseInt(value, (entry.encodeInt) ? entry.encodeInt : 10);
            const registerType = entry.register || "Int16BE"; // Default to Int16BE (was UInt16BE but should be signed)
            
            // Validate value is within range for this register type
            validateRegisterRange(setValue, registerType);
            
            register['write' + registerType](setValue, address);
            break;
        case "float":
        case "enum":
        default:
            throw new Error(`Setting value ${value} as ${entry.type} is not implemented for ${entry.label}`);
    }
}

/**
* Set a bit at position on Uint8Array
* @param {Uint8Array | Uint16Array} array
* @param {number} bitAddress
* @param {boolean} state
*/
function setBit(array, bitAddress, state) {
    if (state === false) {
        array[Math.floor(bitAddress / 8)] &= ~(1 << bitAddress % 8);
    } else {
        array[Math.floor(bitAddress / 8)] |= (1 << bitAddress % 8);
    }
}

/**
 * Read a bit at position on Uint8Array
 * @param {Uint8Array | Uint16Array} array
 * @param {number} bitAddress
 * @param {number} nbBit 8/16
 * @return {boolean}
 */
function readBit(array, bitAddress, nbBit) {
    return (array[Math.floor(bitAddress / nbBit)] & (1 << bitAddress % nbBit)) === (1 << bitAddress % nbBit);
}

/**
 * Update a bit in a Buffer
 * @param {Buffer} register 
 * @param {number} address register address
 * @param {number} offset
 * @param {boolean} state
 */
function setBitToBuffer(register, address, offset, state) {
    if (state === false) {
        register[address] &= ~(1 << offset % 8);
    } else {
        register[address] |= (1 << offset % 8);
    }
}

/**
* Extract address number from field name
* @param {string} key 
* @param {number} address from config
* @param {number} address_offset global address offset depending on constructors
* @returns {number} address number
*/
function getRegisterAddress(key, address, address_offset=0) {
    return (address !== null && address !== undefined) ? address - address_offset : parseInt(key.replace(/[^0-9\.]/g, ''), 10) - address_offset;
}

/**
 * Get buffer address from field name
 * @param {string} key 
 * @param {number | undefined} address 
 * @param {number} address_offset 
 * @param {number | undefined} register_offset
 * @returns {number} address number
 */
function getBufferAddress(key, address, address_offset, register_offset) {
    let addr = getRegisterAddress(key, address, address_offset) * 2;
    if (register_offset !== undefined) {
        if (register_offset < 0 || register_offset > 15) {
            throw new Error(`Offset ${register_offset} not implemented in getBufferAddress for key ${key}`);
        }
        addr += register_offset < 8 ? 1 : 0; // 8-15 -> +0 / 0-7 -> +1
    }
    return addr;
}

 /**
  * read property value from Uint16BE value according to it's type
  * @param {*} entry propertie options
  * @param {*} value
  * @param {*} callback
  */
 function getValueFromRegistery(entry, value, callback) {
    if (typeof value === 'boolean') { //bit
      callback(value);
    }
    else if (typeof value === 'number') {
      let val;
      switch (entry.type) {
        case "boolean":
          if (typeof entry.offset === 'number') {
            val = readBit(new Uint16Array([value]), entry.offset, 16); //ici la valeur provient du Buffer mais elle est lue registre par registre
            callback(val);
          }
          break;
        case "string":
        case "integer":
        default:
          val = value;
          if (typeof entry.offset === 'number') {
            if (entry.offset === 0) {
              val = value & 0xff;
            }
            else {
              val = (value >> entry.offset);
            }
          }
          callback(val);
          break;
      }
    }
    // else { throw new Error(`updateNodeKeyValue not implemented for ${typeof value}`)} //possible on registery writed but not red
 }

 /**
  * Check that offset and register properties are consistent
  * @param {*} entry 
  */
 function CheckOffsetReadWriteProperties(entry) {
  if (entry.register && (!Buffer.prototype['write' + entry.register] || !Buffer.prototype['read' + entry.register])) {
    throw new Error(`Register parameter not appliable as Buffer.write${entry.register} or Buffer.read${entry.register}`);
  }
  if (typeof entry.offset === 'number' && (['string', 'integer'].indexOf(entry.type) >= 0 && [0, 8].indexOf(entry.offset) < 0 || ['string', 'integer', 'boolean'].indexOf(entry.type) < 0)) {
    throw new Error(`Offset ${entry.offset} not implemented for ${entry.type}`);
  }
}


module.exports = {
    setBit,
    readBit,
    writeToRegister,
    getRegisterAddress,
    getBufferAddress,
    getValueFromRegistery,
    CheckOffsetReadWriteProperties,
    OutOfRangeError,
    getRegisterRange,
    validateRegisterRange
}