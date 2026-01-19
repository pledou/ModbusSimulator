// Boolean helpers kept local to avoid duplication between read/write paths
const normalizeBoolean = (value) => (typeof value === 'boolean') ? value : (typeof value === 'string' && value === 'false') ? false : true;
const readBooleanFromWord = (word, offset) => readBit(new Uint16Array([word]), offset, 16);

/**
 * Custom error for values outside valid register range
 */
export class OutOfRangeError extends Error {
  value: number;
  registerType: string;
  minValue: number;
  maxValue: number;

  constructor(value: number, registerType: string, minValue: number, maxValue: number) {
    super(`Value ${value} is out of range for ${registerType} (valid: ${minValue} to ${maxValue})`);
    this.name = 'OutOfRangeError';
    this.value = value;
    this.registerType = registerType;
    this.minValue = minValue;
    this.maxValue = maxValue;
  }
}

/**
 * Register type definition
 */
export type RegisterType = 
  | 'Int8' | 'UInt8'
  | 'Int16BE' | 'Int16LE' | 'UInt16BE' | 'UInt16LE'
  | 'Int32BE' | 'Int32LE' | 'UInt32BE' | 'UInt32LE';

/**
 * Range definition for register types
 */
interface RegisterRange {
  min: number;
  max: number;
}

/**
 * Entry configuration for register operations
 */
export interface RegisterEntry {
  type: 'boolean' | 'integer' | 'string' | 'float' | 'enum';
  register?: RegisterType;
  offset?: number;
  encodeInt?: number;
  label?: string;
  address?: number;
}

/**
 * Get the valid range for a register type
 * @param registerType - Buffer method name without 'write'/'read' prefix (e.g., 'Int16BE', 'UInt16BE')
 * @returns Valid range for the register type
 */
export function getRegisterRange(registerType: string): RegisterRange | null {
  const ranges: Record<string, RegisterRange> = {
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
 * Get the size in bytes for a register type
 * @param registerType - Buffer method name without 'write'/'read' prefix (e.g., 'Int16BE', 'UInt16BE')
 * @returns Size in bytes
 */
export function getRegisterSize(registerType: string | undefined): number {
  if (!registerType) {
    registerType = 'Int16BE';
  }
  if (registerType.includes('8')) return 1;
  if (registerType.includes('16')) return 2;
  if (registerType.includes('32')) return 4;
  if (registerType.includes('64')) return 8;
  return 2; // Default to 2 bytes for unknown types
}

/**
 * Validate that a value is within the valid range for a register type
 * @param value - The value to validate
 * @param registerType - The register type (e.g., 'Int16BE', 'UInt16BE')
 * @throws {OutOfRangeError} If value is outside valid range
 */
export function validateRegisterRange(value: number, registerType: RegisterType): void {
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
 * Read a numeric value from a buffer using the appropriate register type
 * @param entry - Entry configuration object
 * @param buffer - The buffer to read from
 * @returns The value read from the buffer
 */
export function readFromRegister(entry: RegisterEntry | undefined, buffer: Buffer): any {
  // Handle undefined entry
  if (!entry) {
    throw new Error('readFromRegister requires a valid entry parameter');
  }
  
  // registerType by default is 'Int16BE' if not specified
  const registerType = entry.register || 'Int16BE';
  const address = entry.address || 0;
  
  // We should handle boolean type here
  if (entry.type === 'boolean') {
    return getBitFromBuffer(buffer, address, entry.offset || 0);
  }
  return (buffer as any)['read' + registerType](address);
}

/**
 * Write to register (AI-AO) using entry configuration
 * @param entry - Entry configuration object
 * @param value - Value to write
 * @param register - Buffer to update
 */
export function writeValueToRegister(entry: RegisterEntry, value: any, register: Buffer): void {
  const address = entry.address || 0;
  let setValue: any;
  switch (entry.type) { // Homie Convention type
    case "boolean":
      setValue = normalizeBoolean(value);
      setBitToBuffer(register, address, entry.offset || 0, setValue);
      break;
    case "integer":
    case "string":
      setValue = parseInt(value, (entry.encodeInt) ? entry.encodeInt : 10);
      let registerType = entry.register || "Int16BE"; // Default to Int16BE (was UInt16BE but should be signed)    
      // Validate value is within range for this register type
      validateRegisterRange(setValue, registerType);
      // Validate buffer has enough space for the write operation
      const registerSize = getRegisterSize(registerType);
      if (address + registerSize > register.length) {
                throw new RangeError(`Buffer overflow: trying to write ${registerSize} bytes at offset ${address} ` +
                    `in buffer of size ${register.length}. Buffer needs to be at least ${address + registerSize} bytes.`);
            }
      (register as any)['write' + registerType](setValue, address);
      break;
    case "float":
    case "enum":
    default:
      throw new Error(`Setting value ${value} as ${entry.type} is not implemented for ${entry.label}`);
  }
}

/**
 * Set a bit at position on Uint8Array
 * @param array - Array to update
 * @param bitAddress - Bit address
 * @param state - Bit state
 */
export function setBit(array: Uint8Array | Uint16Array, bitAddress: number, state: boolean): void {
  if (state === false) {
    array[Math.floor(bitAddress / 8)] &= ~(1 << bitAddress % 8);
  } else {
    array[Math.floor(bitAddress / 8)] |= (1 << bitAddress % 8);
  }
}

/**
 * Read a bit at position on Uint8Array
 * @param array - Array to read from
 * @param bitAddress - Bit address
 * @param nbBit - Number of bits (8/16)
 * @returns Bit state
 */
export function readBit(array: Uint8Array | Uint16Array, bitAddress: number, nbBit: number): boolean {
  return (array[Math.floor(bitAddress / nbBit)] & (1 << bitAddress % nbBit)) === (1 << bitAddress % nbBit);
}

/**
 * Update a bit in a Buffer
 * @param register - Register buffer
 * @param address - Register address
 * @param offset - Bit offset
 * @param state - Bit state
 */
export function setBitToBuffer(register: Buffer, address: number, offset: number, state: boolean): void {
  if (state === false) {
    register[address] &= ~(1 << offset % 8);
  } else {
    register[address] |= (1 << offset % 8);
  }
}

/**
 * Get a bit from a Buffer
 * @param register - Register buffer
 * @param address - Register address
 * @param offset - Bit offset
 * @returns Bit state
 */
export function getBitFromBuffer(register: Buffer, address: number, offset: number): boolean {
  return (register[address] & (1 << offset % 8)) === (1 << offset % 8);
}

/**
 * Extract address number from field name
 * @param key - Field key
 * @param address - Address from config
 * @param address_offset - Global address offset depending on constructors
 * @returns Address number
 */
export function getRegisterAddress(key: string, address: number | null | undefined, address_offset: number = 0): number {
  return (address !== null && address !== undefined) 
    ? address - address_offset 
    : parseInt(key.replace(/[^0-9\.]/g, ''), 10) - address_offset;
}

/**
 * Get buffer address from field name
 * @param key - Field key
 * @param address - Address from config
 * @param address_offset - Global address offset
 * @param register_offset - Register bit offset
 * @returns Address number
 */
export function getBufferAddress(
  key: string, 
  address: number | undefined, 
  address_offset: number, 
  register_offset?: number
): number {
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
 * Read property value from Uint16BE value according to its type
 * @param entry - Property options
 * @param value - Value to read
 * @param callback - Callback function
 */
export function getValueFromRegistery(
  entry: RegisterEntry, 
  value: boolean | number, 
  callback: (val: any) => void
): void {
  if (typeof value === 'boolean') { // bit
    callback(value);
  }
  else if (typeof value === 'number') {
    let val: any;
    switch (entry.type) {
      case "boolean":
        if (typeof entry.offset === 'number') {
          val = readBooleanFromWord(value, entry.offset); // Value comes from Buffer but is read register by register
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
  // else { throw new Error(`updateNodeKeyValue not implemented for ${typeof value}`)} // Possible on registry written but not read
}

/**
 * Check that offset and register properties are consistent
 * @param entry - Entry configuration
 */
export function CheckOffsetReadWriteProperties(entry: RegisterEntry): void {
  if (entry.register && (!(Buffer.prototype as any)['write' + entry.register] || !(Buffer.prototype as any)['read' + entry.register])) {
    throw new Error(`Register parameter not appliable as Buffer.write${entry.register} or Buffer.read${entry.register}`);
  }
  if (typeof entry.offset === 'number' && (['string', 'integer'].indexOf(entry.type) >= 0 && [0, 8].indexOf(entry.offset) < 0 || ['string', 'integer', 'boolean'].indexOf(entry.type) < 0)) {
    throw new Error(`Offset ${entry.offset} not implemented for ${entry.type}`);
  }
}

// Export as CommonJS for backward compatibility
module.exports = {
  setBit,
  readBit,
  writeValueToRegister,
  readFromRegister,
  getRegisterAddress,
  getBufferAddress,
  getValueFromRegistery,
  CheckOffsetReadWriteProperties,
  OutOfRangeError,
  getRegisterRange,
  validateRegisterRange,
  getRegisterSize
};
