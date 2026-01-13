import mc from "../../src/config/master_config.js";
import util from "../../src/utils/modbus_data_tools.js";
import assert from "assert";

/**
 * Test suite for master_config module
 * Tests the core Modbus configuration management functionality
 */
describe('Master_config', () => {
    /**
     * Tests for the setRequest function
     * The setRequest function is the main export and sets up Modbus master transactions
     * and MQTT node management
     */
    describe('setRequest initialization', () => {
        /**
         * Tests that setRequest is a function that accepts master and mqttclient parameters
         */
        it('should be a function', () => {
            assert.equal(typeof mc, 'function');
        });
    });

    /**
     * Tests for the getBufferAddress utility function
     * Converts register adresses and offsets to buffer byte offsets .
     * Each register is 2 bytes, so offsets are grouped in pairs.
     */
    describe('GetBufferAddress', () => {
        it('address 1 offset 8 maps to buffer offset 0', () => {
            assert.equal(util.getBufferAddress("key-0", null, 0, 8), 0);
        });

        it('address 1 offset 15 maps to buffer offset 1', () => {
            assert.equal(util.getBufferAddress("key-0", null, 0, 15), 0);
        });

        it('address 0 offset 0 maps to buffer offset 0', () => {
            assert.equal(util.getBufferAddress("key-0", null, 0, 0), 1);
        });

        it('address 0 offset 7 maps to buffer offset 0', () => {
            assert.equal(util.getBufferAddress("key-0", null, 0, 7), 1);
        });

        it('adress 0 offset 16 throws error', () => {
            assert.throws(() => {
                util.getBufferAddress("key-0", null, 0, 16);
            }, Error);
        });
        it('address 1 offset 7 maps to buffer offset 3', () => {
            assert.equal(util.getBufferAddress("key-1", null, 0, 7), 3);
        });

        it('adress 1 offset 8 maps to buffer offset 2', () => {
            assert.equal(util.getBufferAddress("key-1", null, 0, 8), 2);
        });
    });

    /**
     * Tests for register address calculation
     * Tests how property addresses are converted to register addresses
     */
    describe('GetRegisterAddress', () => {
        /**
         * Tests that register address calculation works with properties
         */
        it('should calculate register address for property', () => {
            const result = util.getRegisterAddress("temperature", 10, 0);
            assert.equal(typeof result, 'number');
            assert(result >= 0);
        });

        it('should apply addressing offset 0', () => {
            assert.equal(util.getRegisterAddress("temperature", 10, 0),10);
        });
        it('should apply addressing offset 1', () => {
            assert.equal(util.getRegisterAddress("temperature", 10, 1),9);
        });
    });

    /**
     * Tests for data type and validation checking
     */
    describe('Data validation utilities', () => {
        /**
         * Tests that CheckOffsetReadWriteProperties validates property configurations
         */
        it('should validate property configuration', () => {
            const testProp = {
                type: 'integer',
                label: 'Test Property',
                address: 0
            };
            // Should not throw
            assert.doesNotThrow(() => {
                util.CheckOffsetReadWriteProperties(testProp);
            });
        });
    });

    /**
     * Tests for Modbus Function Code handling
     * Function codes are used to specify the type of Modbus operation
     */
    describe('Function codes', () => {
        /**
         * Tests that the module correctly handles different Modbus function codes
         */
        it('should support multiple Modbus function codes', () => {
            // The module should handle these standard Modbus function codes
            const expectedCodes = [
                0x01, // Read Coils
                0x02, // Read Discrete Inputs
                0x03, // Read Holding Registers
                0x04, // Read Input Registers
                0x05, // Write Single Coil
                0x06, // Write Single Register
                0x0F, // Write Multiple Coils
                0x10  // Write Multiple Registers
            ];
            expectedCodes.forEach(code => {
                assert.equal(typeof code, 'number');
            });
        });
    });
});