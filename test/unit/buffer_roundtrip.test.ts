import { expect } from 'chai';
import * as util from '../../src/utils/modbus_data_tools.js';

// Helper to perform a write/read round-trip using current address/buffer helpers
/**
 * Performs a round-trip test by writing a value to a buffer and reading it back.
 * @param entry - The register entry configuration containing type and offset information
 * @param address - The register address
 * @param value - The value to write to the register
 * @returns The value read back from the buffer, either as a bit (for boolean types) or using the appropriate Buffer read method
 */
function roundTrip(entry: util.RegisterEntry, value: any) {
  const registerSize = util.getRegisterSize(entry.register);
  const registerCount = Math.ceil(registerSize / 2);
  const buf = Buffer.alloc(registerCount * 2+ (entry.address || 0) + registerSize );
  util.writeValueToRegister(entry, value, buf);
  return util.readFromRegister(entry, buf);
}

describe('Data Tools - buffer round-trip', () => {
  it('UInt16 round-trips with direct address', () => {
    const entry: util.RegisterEntry = { type: 'integer', register: "UInt16BE" };
    const result = roundTrip(entry, 1234);
    expect(result).to.equal(1234);
  });

  it('Int32 round-trips with later address', () => {
    const entry: util.RegisterEntry = { type: 'integer', register: "Int32BE", address: 2 };
    const result = roundTrip(entry, -123456);
    expect(result).to.equal(-123456);
  });

  it('UInt32 round-trips with later address', () => {
    const entry: util.RegisterEntry = { type: 'integer', register: "UInt32BE", address: 10 };
    // adrOffset shifts the register index; ensure buffer math is still correct
    const result = roundTrip(entry, 3000000000);
    expect(result).to.equal(3000000000);
  });

  it('Boolean bit at offset 0 round-trips', () => {
    const entry: util.RegisterEntry = { type: 'boolean', register: 'Int16BE', offset: 0 };
    const result = roundTrip(entry, true);
    expect(result).to.equal(true);
  });

  it('Boolean bit at offset 9 round-trips', () => {
    const entry: util.RegisterEntry = { type: 'boolean', register: 'Int16BE', offset: 9 };
    const result = roundTrip(entry, true);
    expect(result).to.equal(true);
  });

  it('Default register (Int16BE) parses string payloads', () => {
    const entry: util.RegisterEntry = { type: 'string', register: 'Int16BE' };
    const result = roundTrip(entry, '42');
    expect(result).to.equal(42);
  });

  it('Respects register boundaries for Int32 at non-zero buffer offset', () => {
    const entry: util.RegisterEntry = { type: 'integer', register: 'Int32BE', address: 3 };
    // Address 3 -> byte offset 6; ensure the slice fits and value survives
    const result = roundTrip(entry, 987654);
    expect(result).to.equal(987654);
  });
});
