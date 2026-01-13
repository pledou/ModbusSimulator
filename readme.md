# Modbus Simulator

A tool implementing Modbus over serial and IP (TCP or UDP) based on the [h5.modbus](https://github.com/morkai/h5.modbus) library.

## Prerequisites

- Node.js (v14 or higher) - required if running from source
- For serial communication: appropriate serial port drivers
- For MQTT integration: access to an MQTT broker

## Quick Start

1. Download the portable executable or clone the repository
2. Create an `appconfig.json` file in the same directory
3. Run with: `modbussimulator-x64.exe` or `node ModbusSimulator.js`

See the [examples](examples/) directory for sample configurations.

## Parameters

Modbus Simulator takes a JSON configuration file as a parameter. The default configuration file will be searched in the current path with the following name: `appconfig.json`.

### Launching the Tool

**Using the portable executable:**
```bash
modbussimulator-x64.exe appconfig.json
modbussimulator-x64.exe ./appconfig.json
```

**Using Node.js from source:**
```bash
node ModbusSimulator.js appconfig.json
```

Multiple configuration files can be placed in the same directory, each with a unique name. Only one file can be used by each instance of Modbus Simulator.

**Note:** Multiple instances of Modbus Simulator can be launched in a single command. Example in PowerShell:

```powershell
foreach ($var in Get-ChildItem -Filter "appconfig_*.json") {Start-Process .\modbussimulator-x64.exe $var.Name}
```

### Operating Modes

Modbus Simulator can be launched as master, slave, or both. The configuration file describes the slave and master behavior. If the `slave` or `master` sections are not present in the file, those modules won't be launched.

Modbus Simulator has an MQTT interface to read or write states and values or change simulator behavior.

## Configuration Reference

```json
{
    "$schema": "./schema_appconfig.json", //If JSON editor is compliant (e.g., VS Code), this improves config file editing
    "name": "Simulated Device Name", //Title displayed on MQTT interface
    "device_id": "Device_Instance_Id", //MQTT interface instance identifier, seen in MQTT path, no spaces or special characters allowed except - and _
    //Activates slave module with associated parameters
    "slave":{
        "type":"udp", //tcp, udp, serial-ascii, serial-rtu
        "path":"COM1", //If serial, serial path: Windows default is COM1, Linux default is /dev/ttyS0
        "serialPortOptions": { //If serial, optional options with their default values
            "baudRate": 9600, //The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
            "dataBits": 8, //Must be one of these: 8, 7, 6, or 5
            "lock": true, //Prevent other processes from opening the port. Windows does not currently support `false`.
            "parity": "none", //Must be one of these: 'none', 'even', 'mark', 'odd', 'space'.
            "rtscts": false, //flow control setting
            "stopBits": 1, //Must be one of these: 1 or 2.
            "xany": false, //flow control setting
            "xoff": false, //flow control setting
            "xon": false, //flow control setting
            "highWaterMark": 65536 //The size of the read and write buffers defaults to 64k.
        },
        "serverOptions": { //If TCP or UDP transport type
            "port":502, //Default: 502
            "host":"0.0.0.0" //Restriction on listening address
        },
        //Response delay in ms
        "delay":0,
        //Optional: relative path from ModbusSimulator.exe or ModbusSimulator.js to the script defining slave behavior
        "script":"slave_config.js",
        //Optional: define addressing offset used in DO-xx DI-xx AO-xx AI-xx naming convention for MQTT advertising (default: 0)
        "addressingoffset":1,
        //Display all slave frames
        "debug":true,
        //Display periodic stats
        "stats":false,
        "data":{
            //Optional: define coils advertised through MQTT
            "DO":{
                "DO-00": { //Key: 00 represents the register number if no address is specified; "DO-00" is the property name in MQTT
                    "label":"Module 1 DO 1", //Label published to MQTT interface
                    "address":151 //Optional: specifies register or bit address to override key numbering
                    },
                "DO-01": {"label":"Module 1 DO 2"}
            },
            //Optional: define digital inputs advertised through MQTT
            "DI#1": { //Optional: define unit_id responding to these values. By default, only unit ID 1 is used
                "DI-00": {"label":"Module 1 IO 1"},
                "ELEMENT": //Element key
                {
                    "label":"Module 1 IO 4",
                    "default": true, //Optional start value (Boolean, false by default)
                    "address":151
                }
            },
             "DI#2": { //Optional: define unit_id responding to these values. By default, only unit ID 1 is used
                "DI-00": {"label":"Module 1 IO 1"}
            },
            //Optional: define holding registers advertised through MQTT
            "AO":{
                "AO-00":{
                    "label":"DDP Value",
                    "type":"integer", //Property type (Homie Convention): integer, float, boolean, string, enum, color
                    "default": -32767, //Optional start value
                    "register":"Int16BE", //Optional register read/write method (BigInt64BE, BigInt64LE, BigUInt64BE, BigUInt64LE, DoubleBE, DoubleLE, FloatBE, FloatLE, UInt8, Int8, Int16BE, Int32LE, Int32BE, Int16LE, UInt16BE, UInt32LE, UInt32BE, UInt16LE). Default: UInt16 per Modbus standard
                    "address":151
                    },
                "AO-10-2":{
                    "address":10, //Address used to avoid default value of 102 extracted from "AO-10-2"
                    "label":"Is Locked",
                    "type":"boolean", //Property type (Homie Convention): integer, float, boolean, string, enum, color
                    "default": true, //Optional start value
                    "offset": 0 //Offset reading: range 0-15 for boolean, only 0 and 8 implemented for string and integer
                },
                "AO-1027-08" : {"address":1028, "offset":  8, //Offset of 0 or 8
                    "type":"string", //Displayed in MQTT as string
                    "register":"UInt8", //Encoded in memory as UInt8
                    "encodeInt":16, //Determines base encoding of number to write/read from register to MQTT string and default value string. 16 = Hexadecimal
                    "label" : "Hexadecimal value", "default":"FF"}
            },
            //Optional: define analog inputs (input registers) advertised through MQTT
            "AI":{
                "AI-00":{"label":"DDP Value", "type":"integer", "default": -32767, "register":"Int16BE", "address":151},
                "AI-10-2":{"label":"Is Locked", "type":"boolean","default": true,"offset": 0 , "address":10}
            }
        }
    },
    //Activates master module with associated parameters
    "master":{
        "type":"udp", //tcp, udp, serial-ascii, serial-rtu
        "path":"COM1", //If serial: Windows port COM1 or Linux /dev/ttyS0
        "serialPortOptions": { // if serial, optionals options with their default value
            "baudRate": 9600, //The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
            "dataBits": 8, //Must be one of these: 8, 7, 6, or 5
            "lock": true, //Prevent other processes from opening the port. Windows does not currently support `false`.
            "parity": "none", //Must be one of these: 'none', 'even', 'mark', 'odd', 'space'.
            "rtscts": false, //flow control setting
            "stopBits": 1, //Must be one of these: 1 or 2.
            "xany": false, //flow control setting
            "xoff": false, //flow control setting
            "xon": false, //flow control setting
            "highWaterMark": 65536 //The size of the read and write buffers defaults to 64k.
        },
        "socketOptions": { //If TCP or UDP transport type
            "port":502, //Default: 502
            "host":"localhost", //IP address or DNS name of requested slave (default: localhost)
            "localAddress":"127.1.2.3", //Optional: define address of master
            "localPort":6255,
            "family":4 //Option: 4 for IPv4 or 6 for IPv6
        },
        "unit_id":1, //Default unit ID (default: 1)
        "interval": 500, //Default polling interval in ms (default: 1000)
        //Max concurrent transactions: used to limit requests parameterized in script
        "concurrent_transactions":20,
        //Optional: define addressing offset used in DO-xx DI-xx AO-xx AI-xx naming convention for MQTT advertising (default: 0)
        "addressingoffset":1,
        //Optional: relative path from ModbusSimulator.exe or ModbusSimulator.js to the script defining master behavior
        "script":"master_config.js",
        //Display all master frames
        "debug":true,
        //Display periodic stats
        "stats":false,
        //List of requests to execute
        "requests":[
            {
                //Request name to show on MQTT interface node name
                "label":"Unique Request Name",
                "interval":1500, //Polling interval, by default uses "master/interval"
                "timeout": 1000, //Interval between two requests if there is no response or error
                "ModbusRequestType":"readmultiple", //Options: readmultiple (default), readsingle, or readwrite
                "data": {
                    "AI":{}, //Same as slave
                    "AI#2":{}, //Same as slave, overrides default unit_id
                    "AO":{}, //Same as slave
                    "DI":{}, //Same as slave
                    "DO":{} //Same as slave
                },
                "writedata":{ //Can be added to "data" section if "ModbusRequestType":"readwrite" to write different data
                    "AO":{}, //If defined here, "AO" must exist in "data" also
                    "AO#2":{} //If defined here, "AO#2" must exist in "data" also
                }
            }
        ]
    },
    //Activates MQTT interactions
    "mqtt": {
        //MQTT broker address
        "host": "localhost",
        //MQTT broker port
        "port": 1883,
        //Topic in which our instance will be published
        "base_topic": "devices/",
        //SSL connection
        "auth": false,
        "username": "user",
        "password": "pass",
        //Display all MQTT frames
        "debug":true
      }
}
```

## Behavior

The behavior of the simulator can be overridden by a JavaScript file whose name is defined in the JSON configuration file.

### Slave Behavior

#### Default Slave Behavior

Modbus Simulator's default behavior consists of setting default values to data properties defined in config files.

If MQTT is configured and the data configuration is consistent, then all properties are published to MQTT, following the [Homie Convention](https://homieiot.github.io/).

**MQTT Topic Structure:**
- A digital input will be visible in the topic: `base_topic/device_id/DI(#unit_id)/DI-xxxx`
- To update its value to 1, send `true` to: `base_topic/device_id/DI(#unit_id)/DI-xxxx/set`

#### Custom Slave Behavior

Custom behavior can be added via a JavaScript file (whose path is defined in the config file). The script exports a function which can update the data tables provided as arguments.

```js
'use strict'

function setUnitToData(unittodata, mqttclient) {
    setInterval(function () {
        this[0x01].coils[0] = Math.round(Math.random() * 0xFF);
    }.bind(unittodata), 100);
    setInterval(function () {
        this[0x01].coils[1] = Math.random() > 0.5 ? 0xFF : 0x00;
    }.bind(unittodata), 50);
    setInterval(function () {
        this[0x01].coils[2] = ([0, 1, 2, 4, 8, 16, 32, 64, 128])[Math.round(Math.random() * 9)];
    }.bind(unittodata), 33);
    setInterval(function () {
        this[0x01].discreteInputs[0] = Math.round(Math.random() * 0xFF);
        this[0x01].discreteInputs[1] = Math.round(Math.random() * 0xFF);
        this[0x01].discreteInputs[2] = Math.round(Math.random() * 0xFF);
    }.bind(unittodata), 5000);
}

module.exports = setUnitToData;
```

The Modbus data table is initialized as follows in `SlaveSimulator`:

```js
  initUnitToData() {
    this.UNIT_TO_DATA = {
      0x01: {
        coils: new Array(0xFFFF),
        discreteInputs: new Array(0xFFFF),
        holdingRegisters: Buffer.alloc(0x10000 * 2).fill(0),
        inputRegisters: Buffer.alloc(0x10000 * 2).fill(0)
      }
    };
  }
```

### Master Behavior

#### Default Master Behavior

Modbus Simulator's default behavior consists of setting default values to data properties defined in config files.

If MQTT is configured and the data configuration is consistent, then all properties are published to MQTT, following the [Homie Convention](https://homieiot.github.io/).

**MQTT Topic Structure:**
- A digital input will be visible in the topic: `base_topic/device_id/DI(#unit_id)/DI-xxxx`
- This value is not updatable because a Modbus master cannot update digital inputs
- To update a coil value to 1, send `true` to: `base_topic/device_id/DO(#unit_id)/DO-xxxx/set`

#### Custom Master Behavior

Similar to slave configuration, you can define custom behavior via a script that exports a function which can call `startTransaction` from the `MasterSimulator` object provided as an argument.

```javascript
'use strict';

/**
 * @enum {number}
 */
const eFUNCTIONCODE = {
  ReadDiscreteInputs: 0x02,
  ReadCoils: 0x01,
  WriteSingleCoil: 0x05,
  WriteMultipleCoils: 0x0F,
  ReadInputRegisters: 0x04,
  ReadHoldingRegisters: 0x03,
  WriteSingleRegister: 0x06,
  WriteMultipleRegisters: 0x10,
  ReadWriteMultipleRegisters: 0x17,
  MaskWriteRegister: 0x16,
  ReadFifoQueue: 0x18,
  ReadFileRecord: 0x14,
  WriteFileRecord: 0x15,
  ReadExceptionStatus: 0x07,
  Diagnostic: 0x08,
  GetComEventCounter: 0x0B,
  GetComEventLog: 0x0C,
  ReportServerId: 0x11,
  ReadDeviceIdentification: 0x2B,
  Exception: 0x80
};

const TRANSACTIONS = 10;
const FUNCTION_CODE = eFUNCTIONCODE.ReadDiscreteInputs;
const START_ADDRESS = 0;
const QUANTITY = 8;
const INTERVAL = 500; //Polling delay in ms

function setRequest(master, mqttclient){
    for (let i = 1; i <= TRANSACTIONS; ++i) {
        master.createTransaction(i.toString(), FUNCTION_CODE, QUANTITY, INTERVAL, START_ADDRESS);
      }
}

module.exports = setRequest;
```

### MQTT Behavior

MQTT behavior complies with the Homie Convention, using the [Homie Device](https://github.com/microclimates/homie-device/blob/master/README.md) library.

## Docker Deployment

The tool can be installed in a Docker container image with this command:

```bash
docker build -t modbus_simulator .
```

Alternatively, use docker-compose:

```bash
docker-compose up -d
```

## Troubleshooting

### Common Issues

**Serial Port Access:**
- On Windows: Ensure the COM port is not in use by another application
- On Linux: User must have permissions to access `/dev/ttyS*` devices (add user to `dialout` group)

**MQTT Connection:**
- Verify broker is accessible and credentials are correct
- Check firewall settings if connection fails

**Configuration Errors:**
- Validate JSON syntax using the provided schema files
- Ensure unit IDs match between master and slave configurations

## Examples

See the [examples](examples/) directory for various configuration scenarios:
- `1_minimal_slave/` - Basic slave configuration
- `2_serial_slave/` - Serial port communication
- `3_complex_master/` - Advanced master setup
- `4_alltypes_slave/` - All data types demonstration
- `5_multiunit_slave/` - Multiple unit IDs
- `6_external_refs/` - External file references
- `7_factory_gateway/` - Factory gateway simulation
- `8_serial_variants/` - Serial ASCII and RTU variants
- `9_ipv6_master/` - IPv6 configuration
- `10_multilevel_refs/` - Complex multi-level references

## Testing

### Running Tests

The project uses Mocha as the testing framework. To run tests:

```bash
npm test
```

**Note:** The current test suite is under development. The default test command will display: `Error: no test specified`.

### Test Directory Structure

The `test/` directory contains:
- `master_config.ts` - TypeScript configuration for master testing scenarios

### Development Testing

For manual testing during development:

**Test Slave Mode:**
```bash
node ModbusSimulator.js examples/1_minimal_slave/appconfig.json
```

**Test Master Mode:**
```bash
node ModbusSimulator.js examples/3_complex_master/appconfig.json
```

**Test with Debug Output:**
Set `"debug": true` in the configuration file to see all frames exchanged.

### Writing Tests

When contributing tests, please:
- Use Mocha test framework
- Place test files in the `test/` directory
- Include both unit tests and integration tests where applicable
- Test both master and slave modes
- Test various transport types (TCP, UDP, serial)
- Validate MQTT integration if applicable

### Test Configuration

Test dependencies are specified in [package.json](package.json):
- `mocha` - Test framework
- `@types/mocha` - TypeScript definitions for Mocha

## End-to-End Testing

### Overview

The E2E testing environment provides a complete local setup with:
- **MQTT Broker** (Aedes) on port 1883
- **Modbus Slave** (TCP) on port 1502
- **Modbus Master** connecting to slave
- **Hodd UI** on port 8080 for manual testing

### Quick Start

Start the complete E2E environment:
```bash
npm run e2e:start
```

This will launch all services in separate PowerShell windows:
- MQTT Broker with logging
- Modbus Slave with test data
- Modbus Master polling the slave
- Hodd UI for manual inspection

### Running E2E Tests

With the environment running, execute tests:
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

### Managing E2E Environment

**Stop all services:**
```bash
npm run e2e:stop
```

**Clean logs and data:**
```bash
npm run e2e:clean
```

Note: Data is automatically cleaned when starting a new E2E session.

### Manual Testing with Hodd UI

1. Start the E2E environment: `npm run e2e:start`
2. Open browser to http://localhost:8080
3. View live MQTT messages from devices
4. Inspect Modbus data flow
5. Monitor device states

### E2E Logs and Data

All E2E artifacts are stored in `.e2e/`:
```
.e2e/
├── mqtt/                 # MQTT broker logs
│   └── broker-*.log
├── modbus/
│   ├── slave/           # Slave logs
│   │   └── slave-*.log
│   └── master/          # Master logs
│       └── master-*.log
└── hodd/                # Hodd UI files (optional)
```

Logs include timestamps for correlation and are preserved for analysis after test runs.

### E2E Configuration

Test configurations are in [examples/e2e/](examples/e2e/):
- `slave-appconfig.json` - Test slave with predefined data points
- `master-appconfig.json` - Test master that polls the slave

These configs use localhost networking and are preconfigured for immediate use.

### Troubleshooting E2E

**Ports already in use:**
- Stop existing services: `npm run e2e:stop`
- Check for other processes using ports 1883, 1502, or 8080

**Tests timing out:**
- Ensure E2E environment is fully started (wait ~5 seconds after `e2e:start`)
- Check logs in `.e2e/` directories
- Verify no firewalls blocking localhost connections

**MQTT not connecting:**
- Verify Aedes broker started successfully
- Check `.e2e/mqtt/broker-*.log` for errors

## Release Notes

### 1.2.0
- Fixed bug when trying to write a coil/register not read before

### 1.1.0
- Initial release features

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing style conventions
- Configuration changes include schema updates
- Examples are provided for new features

## License

See LICENSE file for details.
