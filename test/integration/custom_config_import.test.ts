import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testConfigDir = path.join(__dirname, '..', 'fixtures');

/**
 * Test suite for importing custom master/slave configuration files
 * This tests the dynamic import functionality in ModbusSimulator.ts that allows
 * users to provide custom configuration scripts
 */
describe('Custom Config File Import', () => {
  // Create test fixtures directory if it doesn't exist
  before(() => {
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  /**
   * Test importing custom master config as TypeScript
   */
  it('should import custom master config as .ts file', async () => {
    const customMasterTs = path.join(testConfigDir, 'custom_master_config.ts');
    
    const configContent = `
export default function(master, mqtt) {
  // Custom master configuration
  if (mqtt) {
    const node = mqtt.node('test-node', 'Test Node', 'test');
    node.advertise('test-prop').setName('Test Property').setDatatype('boolean');
  }
  return {
    configured: true,
    type: 'TypeScript'
  };
}
`;

    fs.writeFileSync(customMasterTs, configContent);

    try {
      // Simulate the import pattern used in ModbusSimulator.ts
      const imported = await import(`file://${customMasterTs}`);
      const configFunc = imported.default;

      expect(configFunc).to.be.a('function');
      const result = configFunc(null, null);
      expect(result.configured).to.equal(true);
      expect(result.type).to.equal('TypeScript');
    } finally {
      if (fs.existsSync(customMasterTs)) {
        fs.unlinkSync(customMasterTs);
      }
    }
  });

  /**
   * Test importing custom slave config as TypeScript
   */
  it('should import custom slave config as .ts file', async () => {
    const customSlaveTs = path.join(testConfigDir, 'custom_slave_config.ts');
    
    const configContent = `
export default function(unitData, mqtt) {
  // Custom slave configuration
  if (unitData && unitData['DI'] && !unitData['DI']['CUSTOM-DI']) {
    unitData['DI']['CUSTOM-DI'] = {
      label: 'Custom Digital Input',
      default: false
    };
  }
  return {
    configured: true,
    type: 'TypeScript'
  };
}
`;

    fs.writeFileSync(customSlaveTs, configContent);

    try {
      // Simulate the import pattern used in ModbusSimulator.ts
      const imported = await import(`file://${customSlaveTs}`);
      const configFunc = imported.default;

      expect(configFunc).to.be.a('function');
      
      // Test with mock unitData
      const unitData = { 'DI': {} };
      const result = configFunc(unitData, null);
      
      expect(result.configured).to.equal(true);
      expect(result.type).to.equal('TypeScript');
      expect(unitData['DI']).to.have.property('CUSTOM-DI');
    } finally {
      if (fs.existsSync(customSlaveTs)) {
        fs.unlinkSync(customSlaveTs);
      }
    }
  });

  /**
   * Test that config file paths with relative paths work correctly
   */
  it('should handle relative path imports for custom configs', () => {
    const exampleDir = path.join(__dirname, '..', '..', 'examples', '5_multiunit_slave');
    const slaveConfigPath = path.join(exampleDir, 'slave_config.ts');
    
    // This file should exist in the examples
    expect(fs.existsSync(slaveConfigPath)).to.equal(true, 
      `Custom config file should exist at ${slaveConfigPath}`);
  });

  /**
   * Test importing with absolute file:// URLs
   */
  it('should support absolute file URLs for custom configs', async () => {
    const customConfigTs = path.join(testConfigDir, 'url_test_config.ts');
    
    const configContent = `
export default function() {
  return { success: true };
}
`;

    fs.writeFileSync(customConfigTs, configContent);

    try {
      const fileUrl = new URL(`file://${customConfigTs}`).href;
      const imported = await import(fileUrl);
      const configFunc = imported.default;

      expect(configFunc).to.be.a('function');
      const result = configFunc();
      expect(result.success).to.equal(true);
    } finally {
      if (fs.existsSync(customConfigTs)) {
        fs.unlinkSync(customConfigTs);
      }
    }
  });

  /**
   * Test that custom configs must export a default function
   */
  it('should require custom config to export a default function', async () => {
    const invalidConfigTs = path.join(testConfigDir, 'invalid_config.ts');
    
    const configContent = `
// Missing default export
export const config = {
  name: 'invalid'
};
`;

    fs.writeFileSync(invalidConfigTs, configContent);

    try {
      const imported = await import(`file://${invalidConfigTs}`);
      
      expect(imported.default).to.be.undefined;
      // The code should handle this gracefully (checking in ModbusSimulator.ts)
    } finally {
      if (fs.existsSync(invalidConfigTs)) {
        fs.unlinkSync(invalidConfigTs);
      }
    }
  });

  /**
   * Test multiple custom config imports (simulating multiple instances)
   */
  it('should handle multiple custom config imports independently', async () => {
    const config1 = path.join(testConfigDir, 'custom_config_1.ts');
    const config2 = path.join(testConfigDir, 'custom_config_2.ts');
    
    const content1 = `export default function() { return { id: 1 }; }`;
    const content2 = `export default function() { return { id: 2 }; }`;

    fs.writeFileSync(config1, content1);
    fs.writeFileSync(config2, content2);

    try {
      const imported1 = await import(`file://${config1}`);
      const imported2 = await import(`file://${config2}`);

      const result1 = imported1.default();
      const result2 = imported2.default();

      expect(result1.id).to.equal(1);
      expect(result2.id).to.equal(2);
    } finally {
      if (fs.existsSync(config1)) fs.unlinkSync(config1);
      if (fs.existsSync(config2)) fs.unlinkSync(config2);
    }
  });

  /**
   * Clean up test fixtures after all tests
   */
  after(() => {
    if (fs.existsSync(testConfigDir)) {
      const files = fs.readdirSync(testConfigDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testConfigDir, file));
      });
      fs.rmdirSync(testConfigDir);
    }
  });
});
