// Pure CommonJS wrapper for pkg bootstrap
// This file is only used by pkg; the main app uses ModbusSimulator.js
// We dynamically import the ES module

(async () => {
  try {
    await import('./ModbusSimulator.js');
  } catch (err) {
    console.error('Failed to load ModbusSimulator:', err);
    process.exit(1);
  }
})();
