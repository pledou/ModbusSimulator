import { expect } from 'chai';
import * as util from '../../src/utils/modbus_data_tools.js';

describe('Data Tools', () => {
  describe('writeToRegister - Range Validation', () => {
    /**
     * Test that writeToRegister validates input values against register type bounds
     * and throws OutOfRangeError for values outside valid ranges
     */

    describe('Int16BE (signed 16-bit big-endian)', () => {
      const entry = { type: 'integer', register: 'Int16BE', offset: undefined };
      const validBuffer = Buffer.alloc(4);

      it('should write valid positive value (32767)', () => {
        expect(() => {
          util.writeToRegister(entry, 32767, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt16BE(0)).to.equal(32767);
      });

      it('should write valid negative value (-32768)', () => {
        expect(() => {
          util.writeToRegister(entry, -32768, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt16BE(0)).to.equal(-32768);
      });

      it('should write zero', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt16BE(0)).to.equal(0);
      });

      it('should throw OutOfRangeError for value > 32767', () => {
        expect(() => {
          util.writeToRegister(entry, 32768, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for value < -32768', () => {
        expect(() => {
          util.writeToRegister(entry, -32769, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for 54321 (example from issue)', () => {
        expect(() => {
          util.writeToRegister(entry, 54321, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('Int16LE (signed 16-bit little-endian)', () => {
      const entry = { type: 'integer', register: 'Int16LE', offset: undefined };
      const validBuffer = Buffer.alloc(4);

      it('should write valid positive value (32767)', () => {
        expect(() => {
          util.writeToRegister(entry, 32767, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt16LE(0)).to.equal(32767);
      });

      it('should throw OutOfRangeError for value > 32767', () => {
        expect(() => {
          util.writeToRegister(entry, 32768, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('UInt16BE (unsigned 16-bit big-endian)', () => {
      const entry = { type: 'integer', register: 'UInt16BE', offset: undefined };
      const validBuffer = Buffer.alloc(4);

      it('should write valid max unsigned value (65535)', () => {
        expect(() => {
          util.writeToRegister(entry, 65535, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt16BE(0)).to.equal(65535);
      });

      it('should write zero', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt16BE(0)).to.equal(0);
      });

      it('should throw OutOfRangeError for value > 65535', () => {
        expect(() => {
          util.writeToRegister(entry, 65536, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for negative value', () => {
        expect(() => {
          util.writeToRegister(entry, -1, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for 54321 (example from issue)', () => {
        expect(() => {
          util.writeToRegister(entry, 54321, validBuffer, 0);
        }).to.not.throw(); // 54321 is actually valid for UInt16BE (< 65535)
        expect(validBuffer.readUInt16BE(0)).to.equal(54321);
      });
    });

    describe('UInt16LE (unsigned 16-bit little-endian)', () => {
      const entry = { type: 'integer', register: 'UInt16LE', offset: undefined };
      const validBuffer = Buffer.alloc(4);

      it('should write valid max unsigned value (65535)', () => {
        expect(() => {
          util.writeToRegister(entry, 65535, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt16LE(0)).to.equal(65535);
      });

      it('should throw OutOfRangeError for value > 65535', () => {
        expect(() => {
          util.writeToRegister(entry, 65536, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for negative value', () => {
        expect(() => {
          util.writeToRegister(entry, -1, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('Int32BE (signed 32-bit big-endian)', () => {
      const entry = { type: 'integer', register: 'Int32BE', offset: undefined };
      const validBuffer = Buffer.alloc(8);

      it('should write valid positive value (2147483647 - max)', () => {
        expect(() => {
          util.writeToRegister(entry, 2147483647, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32BE(0)).to.equal(2147483647);
      });

      it('should write valid negative value (-2147483648 - min)', () => {
        expect(() => {
          util.writeToRegister(entry, -2147483648, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32BE(0)).to.equal(-2147483648);
      });

      it('should write zero', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32BE(0)).to.equal(0);
      });

      it('should write positive mid-range value (1000000)', () => {
        expect(() => {
          util.writeToRegister(entry, 1000000, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32BE(0)).to.equal(1000000);
      });

      it('should write negative mid-range value (-1000000)', () => {
        expect(() => {
          util.writeToRegister(entry, -1000000, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32BE(0)).to.equal(-1000000);
      });

      it('should throw OutOfRangeError for value > 2147483647', () => {
        expect(() => {
          util.writeToRegister(entry, 2147483648, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for value < -2147483648', () => {
        expect(() => {
          util.writeToRegister(entry, -2147483649, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('Int32LE (signed 32-bit little-endian)', () => {
      const entry = { type: 'integer', register: 'Int32LE', offset: undefined };
      const validBuffer = Buffer.alloc(8);

      it('should write valid positive value (2147483647 - max)', () => {
        expect(() => {
          util.writeToRegister(entry, 2147483647, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32LE(0)).to.equal(2147483647);
      });

      it('should write valid negative value (-2147483648 - min)', () => {
        expect(() => {
          util.writeToRegister(entry, -2147483648, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32LE(0)).to.equal(-2147483648);
      });

      it('should write zero', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt32LE(0)).to.equal(0);
      });

      it('should throw OutOfRangeError for value > 2147483647', () => {
        expect(() => {
          util.writeToRegister(entry, 2147483648, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for value < -2147483648', () => {
        expect(() => {
          util.writeToRegister(entry, -2147483649, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('UInt32BE (unsigned 32-bit big-endian)', () => {
      const entry = { type: 'integer', register: 'UInt32BE', offset: undefined };
      const validBuffer = Buffer.alloc(8);

      it('should write valid max unsigned value (4294967295)', () => {
        expect(() => {
          util.writeToRegister(entry, 4294967295, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32BE(0)).to.equal(4294967295);
      });

      it('should write zero', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32BE(0)).to.equal(0);
      });

      it('should write mid-range value (2147483648)', () => {
        expect(() => {
          util.writeToRegister(entry, 2147483648, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32BE(0)).to.equal(2147483648);
      });

      it('should write large value (3000000000)', () => {
        expect(() => {
          util.writeToRegister(entry, 3000000000, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32BE(0)).to.equal(3000000000);
      });

      it('should throw OutOfRangeError for value > 4294967295', () => {
        expect(() => {
          util.writeToRegister(entry, 4294967296, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for negative value', () => {
        expect(() => {
          util.writeToRegister(entry, -1, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('UInt32LE (unsigned 32-bit little-endian)', () => {
      const entry = { type: 'integer', register: 'UInt32LE', offset: undefined };
      const validBuffer = Buffer.alloc(8);

      it('should write valid max unsigned value (4294967295)', () => {
        expect(() => {
          util.writeToRegister(entry, 4294967295, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32LE(0)).to.equal(4294967295);
      });

      it('should write zero', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32LE(0)).to.equal(0);
      });

      it('should write mid-range value (2147483648)', () => {
        expect(() => {
          util.writeToRegister(entry, 2147483648, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readUInt32LE(0)).to.equal(2147483648);
      });

      it('should throw OutOfRangeError for value > 4294967295', () => {
        expect(() => {
          util.writeToRegister(entry, 4294967296, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });

      it('should throw OutOfRangeError for negative value', () => {
        expect(() => {
          util.writeToRegister(entry, -1, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('Default (Int16BE when register not specified)', () => {
      const entry = { type: 'integer', register: undefined, offset: undefined };
      const validBuffer = Buffer.alloc(4);

      it('should use Int16BE as default', () => {
        expect(() => {
          util.writeToRegister(entry, 12345, validBuffer, 0);
        }).to.not.throw();
        expect(validBuffer.readInt16BE(0)).to.equal(12345);
      });

      it('should apply Int16BE range to default', () => {
        expect(() => {
          util.writeToRegister(entry, 32768, validBuffer, 0);
        }).to.throw(/OutOfRangeError|out of range|Out of range/i);
      });
    });

    describe('Boolean type (should not apply numeric bounds)', () => {
      const entry = { type: 'boolean', offset: 0 };
      const validBuffer = Buffer.alloc(4);

      it('should accept boolean true', () => {
        expect(() => {
          util.writeToRegister(entry, true, validBuffer, 0);
        }).to.not.throw();
      });

      it('should accept boolean false', () => {
        expect(() => {
          util.writeToRegister(entry, false, validBuffer, 0);
        }).to.not.throw();
      });

      it('should accept truthy values', () => {
        expect(() => {
          util.writeToRegister(entry, 1, validBuffer, 0);
        }).to.not.throw();
      });

      it('should accept falsy values', () => {
        expect(() => {
          util.writeToRegister(entry, 0, validBuffer, 0);
        }).to.not.throw();
      });
    });
  });
});
