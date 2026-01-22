// @ts-ignore - CommonJS module
import * as util from "../../src/utils/modbus_data_tools.ts";
import assert from "assert";

/**
 * Test suite for quantity calculation in master configuration
 * This reproduces the issue from inputs_e2e.json where quantity was calculated as NaN
 * 
 * Issue: When properties don't have explicit addresses, the quantity calculation
 * could fail if address extraction from key names produced unexpected values
 */
describe('Quantity Calculation', () => {
    /**
     * Tests address extraction from property keys
     * Keys like "DI-00", "AI-01", "AO-INT32-00" have different patterns
     */
    describe('getRegisterAddress with implicit addresses', () => {
        it('should extract address 0 from DI-00', () => {
            const result = util.getRegisterAddress('DI-00', undefined, 0);
            assert.equal(result, 0);
            assert(!isNaN(result), 'Address should not be NaN');
        });

        it('should extract address 1 from DI-01', () => {
            const result = util.getRegisterAddress('DI-01', undefined, 0);
            assert.equal(result, 1);
            assert(!isNaN(result), 'Address should not be NaN');
        });

        it('should extract address 0 from AI-00', () => {
            const result = util.getRegisterAddress('AI-00', undefined, 0);
            assert.equal(result, 0);
            assert(!isNaN(result), 'Address should not be NaN');
        });

        it('should extract address 1 from AI-01', () => {
            const result = util.getRegisterAddress('AI-01', undefined, 0);
            assert.equal(result, 1);
            assert(!isNaN(result), 'Address should not be NaN');
        });

        /**
         * This is a critical case: keys with type info like "AO-INT32-00"
         * extract digits from the entire key: 3, 2, 0, 0 -> 3200
         * This was a source of the bug
         */
        it('should handle AO-INT32-00 (with explicit address takes precedence)', () => {
            // When address is explicit, it should be used
            const result = util.getRegisterAddress('AO-INT32-00', 2, 0);
            assert.equal(result, 2);
            assert(!isNaN(result), 'Address should not be NaN');
        });

        it('should handle ambiguous keys by requiring explicit address', () => {
            // Per README: Keys with multiple digit sequences like "AO-10-2" or "AO-1027-08"
            // require explicit address field to avoid ambiguity
            // The key "AO-10-2" would extract as 102 (all digits concatenated)
            // but should use explicit address instead
            const ambiguousKey = 'AO-10-2';
            const result = util.getRegisterAddress(ambiguousKey, 10, 0); // Must provide explicit address
            assert.equal(result, 10, 'Should use explicit address when provided');
            assert(!isNaN(result), 'Address should not be NaN');
        });

        /**
         * Critical test: keys with no digits should throw an error, not return NaN
         * This prevents NaN from propagating through the quantity calculation
         */
        it('should throw error for keys with no numeric content', () => {
            assert.throws(
                () => util.getRegisterAddress('NO-DIGITS-HERE', undefined, 0),
                /Cannot extract valid address from key/,
                'Should throw clear error for keys without digits'
            );
        });

        it('should throw error for empty string key', () => {
            assert.throws(
                () => util.getRegisterAddress('', undefined, 0),
                /Cannot extract valid address from key/,
                'Should throw error for empty key'
            );
        });

        it('should throw error for key with only special characters', () => {
            assert.throws(
                () => util.getRegisterAddress('---...___', undefined, 0),
                /Cannot extract valid address from key/,
                'Should throw error for key with no extractable digits'
            );
        });

        it('should never return NaN - always throw or return valid number', () => {
            const testKeys = [
                { key: 'DI-00', address: undefined },
                { key: 'AI-99', address: undefined },
                { key: 'AO-INT32-00', address: 2 },
                { key: 'valid-123', address: undefined }
            ];

            testKeys.forEach(test => {
                const result = util.getRegisterAddress(test.key, test.address, 0);
                assert(!isNaN(result), `getRegisterAddress should never return NaN for key ${test.key}`);
                assert(typeof result === 'number', `Result should be a number for key ${test.key}`);
            });
        });
    });

    /**
     * Tests register size calculation which is used in quantity calculation
     */
    describe('getRegisterSize for different types', () => {
        it('should return 2 bytes for UInt16BE', () => {
            const size = util.getRegisterSize('UInt16BE');
            assert.equal(size, 2);
        });

        it('should return 4 bytes for Int32BE', () => {
            const size = util.getRegisterSize('Int32BE');
            assert.equal(size, 4);
        });

        it('should return 4 bytes for UInt32BE', () => {
            const size = util.getRegisterSize('UInt32BE');
            assert.equal(size, 4);
        });

        it('should return 1 byte for Int8', () => {
            const size = util.getRegisterSize('Int8');
            assert.equal(size, 1);
        });

        it('should return 2 bytes for undefined register type', () => {
            const size = util.getRegisterSize(undefined);
            assert.equal(size, 2);
        });

        it('register size should always be a positive number', () => {
            const types = ['UInt16BE', 'Int32BE', 'UInt32BE', 'Int8', 'FloatBE'];
            types.forEach(type => {
                const size = util.getRegisterSize(type);
                assert(size > 0, `Register size for ${type} should be positive`);
                assert(!isNaN(size), `Register size for ${type} should not be NaN`);
            });
        });
    });

    /**
     * Simulates the quantity calculation logic used in master_config.ts
     * This is what was failing with NaN in the compiled executable
     */
    describe('E2E test data quantity calculations', () => {
        /**
         * Simulates the getQte function from master_config.ts
         * This calculates the quantity of registers needed for a read/write request
         */
        const calculateQuantity = (properties: any[], config: any): number => {
            const lastProp = properties[properties.length - 1];
            const lastEntry = config[lastProp];
            const lastRegisterType = lastEntry.register || 'UInt16BE';
            const lastRegisterSize = util.getRegisterSize(lastRegisterType);
            const lastRegisterCount = Math.ceil(lastRegisterSize / 2); // Convert bytes to 16-bit registers

            const startAddr = util.getRegisterAddress(properties[0], config[properties[0]].address, 0);
            const endAddr = util.getRegisterAddress(lastProp, lastEntry.address, 0);
            const quantity = endAddr - startAddr + lastRegisterCount;

            return quantity;
        };

        it('should calculate quantity for DI section without throwing', () => {
            const di_config = {
                'DI-00': { default: false },
                'DI-01': { default: true }
            };
            const properties = ['DI-00', 'DI-01'];
            
            assert.doesNotThrow(() => {
                const quantity = calculateQuantity(properties, di_config);
                assert(!isNaN(quantity), 'Quantity should not be NaN');
                assert(quantity > 0, 'Quantity should be positive');
            });
        });

        it('should calculate quantity for AI section', () => {
            const ai_config = {
                'AI-00': { label: "Test", type: "integer", default: 100, register: "UInt16BE" },
                'AI-01': { label: "Test", type: "integer", default: 200, register: "UInt16BE" }
            };
            const properties = ['AI-00', 'AI-01'];
            
            const quantity = calculateQuantity(properties, ai_config);
            assert(!isNaN(quantity), 'Quantity should not be NaN');
            assert.equal(quantity, 2, 'Quantity should be 2 for two sequential UInt16 registers');
        });

        it('should calculate quantity for AO section with mixed register types', () => {
            const ao_config = {
                'AO-00': { label: "Output 1", type: "integer", default: 0, register: "UInt16BE" },
                'AO-01': { label: "Output 2", type: "integer", default: 0, register: "UInt16BE" },
                'AO-INT32-00': { label: "Int32 Output 1", type: "integer", default: 0, register: "Int32BE", address: 2 },
                'AO-INT32-01': { label: "Int32 Output 2", type: "integer", default: 0, register: "Int32BE", address: 4 }
            };
            const properties = ['AO-00', 'AO-01', 'AO-INT32-00', 'AO-INT32-01'];
            
            const quantity = calculateQuantity(properties, ao_config);
            assert(!isNaN(quantity), 'Quantity should not be NaN');
            // Should span from address 0 to address 4, plus 2 for Int32 = 6 registers
            assert.equal(quantity, 6, 'Quantity should be 6 for spanning addresses 0-4 with Int32 at end');
        });

        /**
         * This is the critical test for the bug that was fixed
         * The compiled executable was getting NaN for the quantity
         */
        it('all quantities should be valid numbers between 1 and 2000', () => {
            const testSections = [
                {
                    name: 'DI',
                    config: {
                        'DI-00': { default: false },
                        'DI-01': { default: true }
                    }
                },
                {
                    name: 'DO',
                    config: {
                        'DO-00': { default: false },
                        'DO-01': { default: false }
                    }
                },
                {
                    name: 'AI',
                    config: {
                        'AI-00': { type: "integer", default: 100, register: "UInt16BE" },
                        'AI-01': { type: "integer", default: 200, register: "UInt16BE" }
                    }
                }
            ];

            testSections.forEach(section => {
                const properties = Object.keys(section.config).sort();
                const quantity = calculateQuantity(properties, section.config);
                
                assert(!isNaN(quantity), `${section.name}: Quantity should not be NaN`);
                assert(quantity >= 1, `${section.name}: Quantity should be >= 1`);
                assert(quantity <= 2000, `${section.name}: Quantity should be <= 2000`);
            });
        });
    });

    /**
     * Tests that address offset calculations don't produce NaN
     */
    describe('Address offset handling', () => {
        it('should handle positive offset', () => {
            const result = util.getRegisterAddress('temp-10', 10, 1);
            assert(!isNaN(result));
            assert.equal(result, 9);
        });

        it('should handle zero offset', () => {
            const result = util.getRegisterAddress('temp-10', 10, 0);
            assert(!isNaN(result));
            assert.equal(result, 10);
        });

        it('should handle explicit address over key parsing', () => {
            // Explicit address takes precedence
            const result = util.getRegisterAddress('AO-INT32-00', 2, 0);
            assert(!isNaN(result));
            assert.equal(result, 2);
        });

        it('should extract from key when address is null', () => {
            const result = util.getRegisterAddress('temp-42', null, 0);
            assert(!isNaN(result));
            assert.equal(result, 42);
        });
    });

    /**
     * Per README specification: validate proper use of addresses
     * Keys with multiple digit sequences MUST have explicit address field
     */
    describe('Address specification requirements (per README)', () => {
        it('simple keys extract address correctly: DI-00 -> 0, DI-01 -> 1', () => {
            assert.equal(util.getRegisterAddress('DI-00', undefined, 0), 0);
            assert.equal(util.getRegisterAddress('DI-01', undefined, 0), 1);
            assert.equal(util.getRegisterAddress('AI-02', undefined, 0), 2);
        });

        it('keys with multiple numbers should use explicit address', () => {
            // Per README line 149: "Address used to avoid default value of 102 extracted from AO-10-2"
            // This demonstrates that AO-10-2 without explicit address would incorrectly extract 102
            const ambiguousKey = 'AO-10-2';
            // When explicit address is provided, it should be used
            const result = util.getRegisterAddress(ambiguousKey, 10, 0);
            assert.equal(result, 10, 'Should use explicit address=10, not extracted 102');
        });

        it('keys with complex numbering should use explicit address', () => {
            // Per README line 155: "AO-1027-08" requires explicit address
            const complexKey = 'AO-1027-08';
            // Without explicit address, this would extract 102708
            const result = util.getRegisterAddress(complexKey, 1028, 0);
            assert.equal(result, 1028, 'Should use explicit address=1028');
        });

        it('validate that e2e test data follows specification', () => {
            // The e2e test data should have simple names like AI-00, AI-01
            // or explicit addresses for complex ones like AO-INT32-00 (with address field)
            const validConfigs = [
                { key: 'AI-00', address: undefined, shouldWork: true },
                { key: 'AI-01', address: undefined, shouldWork: true },
                { key: 'AO-INT32-00', address: 2, shouldWork: true },
                { key: 'AO-INT32-01', address: 4, shouldWork: true }
            ];

            validConfigs.forEach(config => {
                const result = util.getRegisterAddress(config.key, config.address, 0);
                assert(!isNaN(result), `${config.key} should produce valid address`);
                if (config.address !== undefined) {
                    assert.equal(result, config.address, `${config.key} should use explicit address ${config.address}`);
                }
            });
        });

        /**
         * Test for potential issue: ambiguous keys without explicit address
         * This represents a configuration error that should be caught
         */
        it('should detect ambiguous key patterns that should require explicit address', () => {
            // Keys with multiple number sequences are ambiguous
            // Example: "AO-10-2" extracts as 102 (concatenated: 1,0,2)
            // but the intent might be register 10 with offset 2
            const ambiguousKey = 'AO-10-2';
            const extractedAddress = util.getRegisterAddress(ambiguousKey, undefined, 0);
            
            // The extraction produces 102, which might not be intended
            // This is why explicit address is required for such keys
            assert.equal(extractedAddress, 102, 'Ambiguous key AO-10-2 extracts to 102 from digits alone');
            assert(!isNaN(extractedAddress), 'Should not be NaN');
            
            // The lesson: complex keys MUST use explicit address field
            // This test documents why the specification requires it
        });
    });
});
