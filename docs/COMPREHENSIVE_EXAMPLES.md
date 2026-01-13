# Comprehensive Configuration Examples for ModbusSimulator

This document provides exhaustive examples covering all possibilities of `appconfig_*`, `inputs_*`, and `slave_config_*` file combinations with all data types and references.

All example files are located in the [examples/](examples/) directory with the following structure:

```
examples/
├── 1_minimal_slave/              → Simplest TCP slave
├── 2_serial_slave/               → Serial RTU with script
├── 3_complex_master/             → Master with multiple requests
├── 4_alltypes_slave/             → All data types demonstrated
├── 5_multiunit_slave/            → Multiple Unit IDs (0x01, 0x02, 0x03)
├── 6_external_refs/              → Modular file references
├── 7_factory_gateway/            → Complete master+slave gateway
├── 8_serial_variants/            → ASCII and RTU variants
├── 9_ipv6_master/                → IPv6 UDP communication
└── 10_multilevel_refs/           → Deep reference chains with shared/
    └── shared/                   → Reusable component definitions
```

## File Types Overview

The ModbusSimulator configuration system has three main file types:

1. **appconfig_*.json** - Main configuration files (references [schema_appconfig.json](schema_appconfig.json))
   - Define slave/master configurations
   - Reference input files and scripts
   - Configure MQTT connectivity
   - Located in example directories as `appconfig.json`

2. **inputs_*.json** - Data definition files (references [schema_data.json](schema_data.json))
   - Define DI (Digital Inputs), DO (Coils), AI (Input Registers), AO (Holding Registers)
   - Can use `$ref` to reference other files
   - Can embed inline or reference external definitions
   - Can use anchors like `#/registers` to target specific sections

3. **slave_config_*.js** - JavaScript scripts that customize slave behavior
   - Dynamically modify register values
   - Custom business logic (simulations, calculations)
   - Event-driven updates using interval timers
   - Called with `unittodata` parameter for register access

## Data Type Hierarchy

```
schema_appconfig.json
├── schema_data.json
│   ├── schema_coils.json (DI, DO)
│   └── schema_registers.json (AI, AO)
```

### Register Types (schema_registers.json)

**Integer types:**
- `BigInt64BE`, `BigInt64LE`, `BigUInt64BE`, `BigUInt64LE`
- `DoubleBE`, `DoubleLE`, `FloatBE`, `FloatLE`
- `Int8`, `Int16BE`, `Int16LE`, `Int32BE`, `Int32LE`
- `UInt8`, `UInt16BE`, `UInt16LE`, `UInt32BE`, `UInt32LE`

**Property types:**
- `integer`, `float`, `boolean`, `string`, `enum`, `color`

### Reference Patterns

References use JSON Pointer syntax:

- **Internal reference**: `#/data/registers` (root-level reference)
- **Path reference**: `#data/request1` (simplified path)
- **External file**: `./inputs_equipment.json` (external file)
- **External with anchor**: `./inputs_equipment.json#/digitals` (specific section)
- **Complex internal**: `./inputs_equipment.json#/data/registers`

---

## EXAMPLE 1: Minimal Slave Configuration (TCP)

**Location:** [examples/1_minimal_slave](examples/1_minimal_slave)

**Configuration File:** [appconfig.json](examples/1_minimal_slave/appconfig.json)

This is the simplest possible slave configuration using TCP with inline digital inputs.

### Usage:
```bash
node ModbusSimulator.js examples/1_minimal_slave/appconfig.json
```

**Features:**
- TCP server on port 502
- Two digital inputs (DI-01, DI-02)
- No MQTT broker connection
- Inline data definition (no external file references)

---

## EXAMPLE 2: Serial Slave Configuration (RTU Mode)

**Location:** [examples/2_serial_slave](examples/2_serial_slave)

**Files:**
- [appconfig.json](examples/2_serial_slave/appconfig.json) - Main configuration
- [slave_config.js](examples/2_serial_slave/slave_config.js) - Custom behavior script

This example demonstrates serial communication in RTU (binary) mode with dynamic value updates.

### Usage:
```bash
node ModbusSimulator.js examples/2_serial_slave/appconfig.json
```

**Features:**
- Serial RTU communication on COM3, 9600 baud
- Custom script updates DI-01 every 5 seconds
- MQTT monitoring on localhost:1883
- 100ms delay between responses

The [slave_config.js](examples/2_serial_slave/slave_config.js) script demonstrates how to programmatically update register values using interval timers.

---

## EXAMPLE 3: Master Configuration with Multiple Request Types

**Location:** [examples/3_complex_master](examples/3_complex_master)

**Configuration File:** [appconfig.json](examples/3_complex_master/appconfig.json)

This example shows a master device with three different request types demonstrating all Modbus operations.

### Usage:
```bash
node ModbusSimulator.js examples/3_complex_master/appconfig.json
```

**Features:**
- TCP client connecting to 192.168.1.100:502
- Three concurrent request types:
  1. **Read Input Registers** (AI) - Temperature, Pressure, Humidity
  2. **Read/Write Holding Registers** (AO) - Mixed read/write operations
  3. **Read Coils** (DO) - Digital outputs
- Configurable intervals per request (500ms, 1000ms, 2000ms)
- MQTT publishing with authentication
- Up to 20 concurrent transactions

The configuration references the [master_config.js](master_config.js) script for request execution logic.

---

## EXAMPLE 4: Slave with All Data Types Inline

**Location:** [examples/4_alltypes_slave](examples/4_alltypes_slave)

**Configuration File:** [appconfig.json](examples/4_alltypes_slave/appconfig.json)

This comprehensive example demonstrates every supported data type and register format.

### Usage:
```bash
node ModbusSimulator.js examples/4_alltypes_slave/appconfig.json
```

**Data Types Covered:**

| Type | Example Register | Format |
|------|------------------|--------|
| Boolean (single bit) | AO-01 | `type: "boolean"` with offset |
| 8-bit Integer | AI-06 | `register: "UInt8"` |
| 16-bit Signed | AI-03 | `register: "Int16BE"` |
| 32-bit Unsigned | AI-04 | `register: "UInt32BE"` |
| 64-bit Float | AI-05 | `register: "DoubleBE"` |
| String (hex encoded) | AI-06 | `type: "string"`, `encodeInt: 16` |
| Float (single precision) | AO-03 | `register: "FloatLE"` |
| Enum | Control_Mode | `type: "enum"` |
| Color | RGB_Color | `type: "color"` |
| Multi-bit fields | AO-04-00, AO-04-08 | Multiple offsets in same register |

**Features:**
- UDP server mode
- Addressing offset of 0 (absolute addressing)
- 10 analog inputs with various types
- 10+ holding registers covering all data formats
- MQTT monitoring enabled

---

## EXAMPLE 5: Multi-Unit Slave with Unit ID References

**Location:** [examples/5_multiunit_slave](examples/5_multiunit_slave)

**Files:**
- [appconfig.json](examples/5_multiunit_slave/appconfig.json) - Main configuration
- [slave_config.js](examples/5_multiunit_slave/slave_config.js) - Multi-unit behavior

This example demonstrates how to configure a single Modbus slave that responds on multiple Unit IDs (addresses) simultaneously.

### Usage:
```bash
node ModbusSimulator.js examples/5_multiunit_slave/appconfig.json
```

**Unit ID Configuration:**
- **Unit 1 (0x01)**: DI inputs toggle every 1000ms
- **Unit 2 (0x02)**: AO registers increment every 500ms
- **Unit 3 (0x03)**: DI inputs toggle every 2000ms

**Syntax:**
- `"DI"` - Data for default Unit 1
- `"DI#2"` - Data for Unit 2
- `"DI#3"` - Data for Unit 3

The [slave_config.js](examples/5_multiunit_slave/slave_config.js) script shows how to access and update data for specific unit IDs using the `unittodata[unitId]` mapping.

---

## EXAMPLE 6: Slave with External Data References

**Location:** [examples/6_external_refs](examples/6_external_refs)

**Files:**
- [appconfig.json](examples/6_external_refs/appconfig.json) - Main configuration
- [inputs_device_core.json](examples/6_external_refs/inputs_device_core.json) - Core data with refs
- [inputs_device_sensors.json](examples/6_external_refs/inputs_device_sensors.json) - Sensor definitions
- [inputs_device_registers.json](examples/6_external_refs/inputs_device_registers.json) - Register definitions

This example demonstrates modular configuration with external file references and anchors.

### Usage:
```bash
node ModbusSimulator.js examples/6_external_refs/appconfig.json
```

**Reference Chain:**
```
appconfig.json
  └─ $ref: ./inputs_device_core.json
      ├─ DI
      │   ├─ Inline: System_Status, Error_Flag
      │   └─ $ref: ./inputs_device_sensors.json
      └─ AO
          └─ $ref: ./inputs_device_registers.json#/registers
```

**Key Concepts:**
1. **File-level reference**: `$ref: ./inputs_device_core.json`
2. **External file reference**: `$ref: ./inputs_device_sensors.json`
3. **Anchored reference**: `$ref: ./inputs_device_registers.json#/registers`
4. **Inline + external mix**: System_Status inline, then external sensors

This structure allows reusing sensor definitions across multiple configurations.

---

## EXAMPLE 7: Complete Industrial System (Slave + Master + Monitoring)

**Location:** [examples/7_factory_gateway](examples/7_factory_gateway)

**Files:**
- [appconfig.json](examples/7_factory_gateway/appconfig.json) - Gateway config (slave + master)
- [inputs_factory_slave.json](examples/7_factory_gateway/inputs_factory_slave.json) - Slave data definition
- [slave_config.js](examples/7_factory_gateway/slave_config.js) - Simulated factory behavior

This comprehensive example shows a real-world PLC gateway that:
- Acts as a **slave** to upper-level SCADA systems
- Acts as a **master** to field equipment
- Monitors MQTT for system health
- Simulates realistic industrial sensor behavior

### Usage:
```bash
node ModbusSimulator.js examples/7_factory_gateway/appconfig.json
```

**Slave Side (Responds to SCADA):**
- Digital inputs: Emergency Stop, Power Supply, System Ready, Door sensors
- Digital outputs: Pump, Motor, Heater, Alarm controls
- Input registers: Pressure, Temperature, Flow Rate, Motor Speed, Power
- Holding registers: Speed setpoint, Temperature setpoint, Pressure limit

**Master Side (Polls Equipment):**
- Request 1: SCADA system read (500ms interval)
- Request 2: Equipment control with read/write (1000ms interval)

**Simulation Features** (see [slave_config.js](examples/7_factory_gateway/slave_config.js)):
- Pressure varies randomly (±0.5 bar/500ms)
- Temperature tracks heater state (±0.5°C/s)
- Motor speed ramps up/down based on control signals
- All changes published to MQTT automatically

---

## EXAMPLE 8: Serial Communication Variants

**Location:** [examples/8_serial_variants](examples/8_serial_variants)

**Files:**
- [appconfig_ascii.json](examples/8_serial_variants/appconfig_ascii.json) - Serial ASCII mode
- [appconfig_master_rtu.json](examples/8_serial_variants/appconfig_master_rtu.json) - Serial RTU master with handshake

### Serial ASCII Mode (Slave)

**File:** [appconfig_ascii.json](examples/8_serial_variants/appconfig_ascii.json)

ASCII mode transmits data as printable text. Useful for legacy systems and debugging.

**Features:**
- Path: `/dev/ttyUSB0` (Linux) or `COM1` (Windows)
- Baud rate: 19200
- Parity: EVEN (7-bit data)
- Flow control: XON/XOFF software handshake
- Good for: Older equipment, debugging

### Serial RTU Master with RTS/CTS

**File:** [appconfig_master_rtu.json](examples/8_serial_variants/appconfig_master_rtu.json)

RTU (binary) mode is faster and more efficient. RTS/CTS provides hardware handshake.

**Features:**
- Path: `COM4` (Windows)
- Baud rate: 115200 (high speed)
- Hardware handshake: RTS/CTS
- Buffer size: 16384 bytes
- Good for: Fast communication, noisy environments

**Comparison:**

| Feature | ASCII | RTU |
|---------|-------|-----|
| Format | Text (hex) | Binary |
| Overhead | ~50% larger | Minimal |
| Baud rate | Low-medium | High |
| Debugging | Easy (readable) | Harder |
| Legacy support | Better | Universal |
| Flow control | Software (XON/XOFF) | Hardware (RTS/CTS) |

---

## EXAMPLE 9: UDP Communication with IPv6

**Location:** [examples/9_ipv6_master](examples/9_ipv6_master)

**Configuration File:** [appconfig.json](examples/9_ipv6_master/appconfig.json)

This example demonstrates IPv6 UDP communication for modern network environments.

### Usage:
```bash
node ModbusSimulator.js examples/9_ipv6_master/appconfig.json
```

**Features:**
- Protocol: UDP (connectionless, lower latency)
- IPv6 address: `::1` (localhost IPv6)
- Local binding: `::1:5021` (forces IPv6 stack)
- Family: 6 (explicitly IPv6)
- Request interval: 1000ms
- Single sensor read (AI-01)

**When to Use IPv6:**
- Modern networks with IPv6 support
- IoT devices requiring modern stack
- Cloud-native deployments
- When you need more address space

**Compatibility:**
- Requires IPv6 support on network
- Can coexist with IPv4 (dual stack)
- Faster than IPv4 in some scenarios
- Better multicast support

---

## EXAMPLE 10: Complex Data with Multiple Reference Levels

**Location:** [examples/10_multilevel_refs](examples/10_multilevel_refs)

**Files:**
- [appconfig.json](examples/10_multilevel_refs/appconfig.json) - Main configuration
- [inputs_complex_main.json](examples/10_multilevel_refs/inputs_complex_main.json) - Reference hub
- [shared/inputs_complex_digitals.json](examples/10_multilevel_refs/shared/inputs_complex_digitals.json) - Digital inputs
- [shared/inputs_complex_coils.json](examples/10_multilevel_refs/shared/inputs_complex_coils.json) - Coil outputs
- [shared/inputs_complex_inputs.json](examples/10_multilevel_refs/shared/inputs_complex_inputs.json) - Input registers
- [shared/inputs_complex_outputs.json](examples/10_multilevel_refs/shared/inputs_complex_outputs.json) - Output registers

This advanced example demonstrates a highly modular architecture with deep reference chains and shared components.

### Usage:
```bash
node ModbusSimulator.js examples/10_multilevel_refs/appconfig.json
```

**File Structure:**
```
examples/10_multilevel_refs/
├── appconfig.json (references inputs_complex_main.json)
├── inputs_complex_main.json (references 4 files in shared/)
└── shared/
    ├── inputs_complex_digitals.json (Safety_Switch, Enable_Signal, Warning_Light)
    ├── inputs_complex_coils.json (Pump_Enable, Motor_Start, Alarm_Output)
    ├── inputs_complex_inputs.json (Temperature, Pressure, Flow registers)
    └── inputs_complex_outputs.json (Speed, Temp Setpoint, Mode registers)
```

**Reference Architecture:**
```
appconfig.json
  └─ slave.data: ./inputs_complex_main.json
      ├─ DI: ./shared/inputs_complex_digitals.json#/digitals
      ├─ DO: ./shared/inputs_complex_coils.json#/digitals
      ├─ AI: ./shared/inputs_complex_inputs.json#/registers
      └─ AO: ./shared/inputs_complex_outputs.json#/registers
```

**Key Advantages:**
1. **Reusability**: Shared files can be used by multiple configs
2. **Maintainability**: Central definitions easier to update
3. **Scalability**: Easy to add new devices by composition
4. **Clarity**: Each file has a single responsibility
5. **Anchors**: `#/digitals` and `#/registers` allow flexible naming

**Real-World Use:**
- Multi-site deployments (different locations share same sensor defs)
- Modular systems (plug-and-play device configurations)
- Version control (shared files in version control, device configs in environment vars)

---

## Reference Resolution Rules

### 1. **Inline References**
- Format: Direct property definitions
- Used when: Small, single-use datasets
- Example: See EXAMPLE 1, EXAMPLE 4

### 2. **Internal JSON Pointers**
- Format: `#/path/to/element`
- Used when: Multiple sections in same file
- Example in EXAMPLE 7: Master requests referencing `#/data/scada_inputs`

### 3. **External File References**
- Format: `./filename.json`
- Used when: Shared data across multiple configs
- Example: See EXAMPLE 5, EXAMPLE 6

### 4. **Anchored External References**
- Format: `./filename.json#/path/to/section`
- Used when: Specific section from external file
- Example in EXAMPLE 6: `./inputs_device_registers.json#/registers`

### 5. **Schema References**
- Format: `"$schema": "./schema_data.json"`
- Used in: Every inputs file to enable validation
- Must reference: schema_data.json or schema_appconfig.json

---

## Modbus Function Codes by Request Type

```
DI (Digital Inputs)
├── readmultiple: 0x02 (Read Discrete Inputs)
└── readsingle: 0x02

DO (Coils)
├── readmultiple: 0x01 (Read Coils)
├── readsingle: 0x01
├── write single: 0x05 (Write Single Coil)
└── write multiple: 0x0F (Write Multiple Coils)

AI (Input Registers)
├── readmultiple: 0x04 (Read Input Registers)
└── readsingle: 0x04

AO (Holding Registers)
├── readmultiple: 0x03 (Read Holding Registers)
├── readsingle: 0x03
├── write single: 0x06 (Write Single Register)
├── write multiple: 0x10 (Write Multiple Registers)
└── read/write: 0x17 (Read/Write Multiple Registers)
```

---

## Addressing Offset Behavior

The `addressingoffset` property affects how addresses are displayed in MQTT topics:

```
Without offset (addressingoffset: 0):
- DI-01, DI-02, DI-03...

With offset (addressingoffset: 1):
- DI-02, DI-03, DI-04... (addresses incremented by 1)
```

---

## Key Combinations Summary

| Config Type | Mode | Connection | Data Source | Behavior |
|---|---|---|---|---|
| Slave | TCP | Server | Inline DI/DO/AI/AO | Responds to master requests |
| Slave | UDP | Server | `$ref` to file | Responds to master requests |
| Slave | Serial RTU | COM Port | `$ref` + script | Responds on serial line |
| Slave | Serial ASCII | COM Port | Script-driven | ASCII format only |
| Master | TCP | Client | `$ref` internal | Polls remote slave |
| Master | UDP | Client | Script + requests | UDP polling |
| Master | Serial | COM Port | Script-driven | Serial polling |
| Both | TCP | Both | External refs | Gateway/relay mode |

---

## Best Practices

1. **Use External References** for shared data across multiple instances
2. **Use Scripts** when register values need dynamic updates
3. **Set addressingoffset: 1** for human-readable addressing (starts at 1, not 0)
4. **Use Explicit Register Types** (UInt16BE, FloatBE, etc.) for clarity
5. **Enable Debug Mode** during development, disable in production
6. **Use MQTT Auth** for secure deployments
7. **Organize Files** by functional area (sensors, controls, status)
8. **Document Intervals** - faster intervals = higher CPU usage

---

## Validation Tips

- All JSON files must reference correct schema (`"$schema": "./schema_*.json"`)
- Register addresses must be unique within the same type
- Bit offsets: 0-15 valid (0-7 for first byte, 8-15 for second byte)
- Unit IDs: 0-255 valid (typically 1-247)
- Port numbers: 0-65535
- Baud rates: 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200

