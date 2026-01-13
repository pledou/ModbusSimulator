# E2E Test Configurations

This directory contains configuration files for end-to-end testing.

## Files

- **slave-appconfig.json** - Modbus TCP slave configuration
  - Listens on port 1502
  - Provides test data for DI, DO, AI, AO
  - Publishes to MQTT at localhost:1883

- **master-appconfig.json** - Modbus TCP master configuration
  - Connects to slave at localhost:1502
  - Polls various data types
  - Publishes to MQTT at localhost:1883

## Usage

These configurations are used automatically when running:
```bash
npm run e2e:start
```

Or manually:
```bash
# Terminal 1: Start MQTT Broker
.\scripts\start-mqtt.ps1

# Terminal 2: Start Slave
.\scripts\start-slave.ps1

# Terminal 3: Start Master
.\scripts\start-master.ps1

# Terminal 4: Start Hodd UI
.\scripts\start-hodd.ps1
```

## Test Data

The slave provides the following test points:
- **DI-00**: Digital Input (default: false)
- **DI-01**: Digital Input (default: true)
- **DO-00, DO-01**: Digital Outputs (writable)
- **AI-00**: Analog Input (default: 100)
- **AI-01**: Analog Input (default: 200)
- **AO-00, AO-01**: Analog Outputs (writable)

The master polls these values and publishes them to MQTT.
