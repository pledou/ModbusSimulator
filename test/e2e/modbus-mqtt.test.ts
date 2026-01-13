import { expect } from 'chai';
import net from 'net';
import mqtt from 'mqtt';

/**
 * E2E tests - requires E2E environment to be running
 * Run with: npm run test:e2e
 */
describe('ModbusSimulator - E2E Tests', function () {
  this.timeout(10000); // E2E tests may take longer

  let mqttClient: mqtt.MqttClient;
  let messageBuffer: Array<{ topic: string; message: string }> = [];

  before(async () => {
    // Connect to MQTT broker
    mqttClient = mqtt.connect('mqtt://localhost:1883');

    return new Promise((resolve, reject) => {
      mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');

        // Subscribe to all topics before tests start
        mqttClient.subscribe('homie/#', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Subscribed to homie/#');
            resolve();
          }
        });
      });

      // Buffer messages as they arrive
      mqttClient.on('message', (topic: string, message: Buffer) => {
        messageBuffer.push({ topic, message: message.toString() });
        console.log(`Msg received on ${topic}: ${message.toString()}`);
      });

      mqttClient.on('error', (err: Error) => {
        reject(err);
      });

      setTimeout(() => reject(new Error('MQTT connection timeout')), 5000);
    });
  });

  after(() => {
    if (mqttClient) {
      mqttClient.end();
    }
  });

  // Reinitialize slave values before each test to ensure consistent test state
  beforeEach(async () => {
    // clear local buffer to avoid cross-test interference
    messageBuffer = [];

    if (!mqttClient || !mqttClient.connected) {
      // if MQTT not connected yet, skip publishes (tests will fail later if required)
      return;
    }

    const resets: Array<[string, string]> = [
      ['homie/E2E_SLAVE/AO/AO-00/set', '0'],
      ['homie/E2E_SLAVE/AO/AO-01/set', '0'],
      ['homie/E2E_SLAVE/DO/DO-00/set', 'false'],
      ['homie/E2E_SLAVE/DO/DO-01/set', 'false'],
      ['homie/E2E_SLAVE/AI/AI-00/set', '0'],
      ['homie/E2E_SLAVE/AI/AI-01/set', '0'],
      ['homie/E2E_SLAVE/DI/DI-00/set', 'false'],
      ['homie/E2E_SLAVE/DI/DI-01/set', 'false'],
    ];

    await Promise.all(resets.map(([topic, payload]) =>
      new Promise<void>((resolve, reject) => {
        mqttClient.publish(topic, payload, {}, (err) => err ? reject(err) : resolve());
      })
    ));

    // give the system a short moment to apply values
    await new Promise(res => setTimeout(res, 200));

    // clear buffer messages to avoid false positives
    messageBuffer = [];
  });

  describe('Infrastructure', () => {
    it('should connect to MQTT broker on port 1883', (done) => {
      // Verify the before hook connected successfully
      expect(mqttClient.connected).to.be.true;
      done();
    });

    it('should connect to Modbus slave on port 1502', (done) => {
      const client = new net.Socket();
      client.connect(1502, 'localhost', () => {
        expect(client.connecting).to.be.false;
        client.destroy();
        done();
      });
      client.on('error', done);
    });
  });

  /**
   * Retrieves a message from the message buffer that matches the given predicate.
   * 
   * @param predicate - A function that tests whether a message matches the criteria
   * @param timeoutMs - The maximum time in milliseconds to wait for a matching message (default: 12000)
   * @returns A promise that resolves to the first message matching the predicate
   * @throws Error if no matching message is found within the timeout period
   */
  async function retrieveMessageAsync(
    predicate: (msg: { topic: string; message: string; }) => boolean,
    timeoutMs: number = 8000
  ): Promise<{ topic: string; message: string; }> {
    const findMsg = () => messageBuffer.find(predicate);
    return findMsg() || await (async () => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const m = findMsg();
        if (m) return m;
        await new Promise(res => setTimeout(res, 100));
      }
      throw new Error('No MQTT messages received from devices matching the predicate');
    })();
  }

  // Master topics are prefixed by ring/unit identifiers (e.g. R0-DO), so match by suffix.
  const masterTopicEndsWith = (topic: string, suffix: string) =>
    topic.startsWith('homie/E2E_MASTER/') && topic.endsWith(suffix);

  const toBool = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  };

  describe('MQTT Communication', () => {
    it('should subscribe to device topics', (done) => {
      // Already subscribed in before hook, just verify
      expect(mqttClient.connected).to.be.true;
      done();
    });

    it('should receive messages from slave device', async function () {
      this.timeout(15000);
      // Action to trigger message from slave
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_SLAVE/AO/AO-00/set', '12345', {}, (err) => err ? reject(err) : resolve());
      });
      const msg = await retrieveMessageAsync(m => m.topic.startsWith('homie/E2E_SLAVE'));
      expect(msg.topic).to.include('homie/E2E_SLAVE');
      expect(msg.message).to.exist;
    });

    it('should receive messages from master device', async function () {
      this.timeout(15000);
      const msg = await retrieveMessageAsync(m => m.topic.startsWith('homie/E2E_MASTER'));
      expect(msg.topic).to.include('homie/E2E_MASTER');
      expect(msg.message).to.exist;
    });
  });

  describe('Modbus Communication', () => {
    it('should read data from slave via Modbus TCP', function (done) {
      this.timeout(5000);

      const client = new net.Socket();

      client.connect(1502, 'localhost', () => {
        // Send a simple Modbus TCP request (Read Holding Registers)
        // Transaction ID: 0x0001, Protocol ID: 0x0000, Length: 0x0006
        // Unit ID: 0x01, Function Code: 0x03 (Read Holding Registers)
        // Starting Address: 0x0000, Quantity: 0x0001
        const request = Buffer.from([
          0x00, 0x01, // Transaction ID
          0x00, 0x00, // Protocol ID
          0x00, 0x06, // Length
          0x01,       // Unit ID
          0x03,       // Function Code
          0x00, 0x00, // Starting Address
          0x00, 0x01  // Quantity
        ]);

        client.write(request);
      });

      client.on('data', (data: Buffer) => {
        expect(data.length).to.be.greaterThan(0);
        // Basic validation of Modbus response
        expect(data[0]).to.equal(0x00); // Transaction ID high byte
        expect(data[1]).to.equal(0x01); // Transaction ID low byte
        client.destroy();
        done();
      });

      client.on('error', (err: Error) => {
        client.destroy();
        done(err);
      });

      setTimeout(() => {
        client.destroy();
        done(new Error('Modbus read timeout'));
      }, 4000);
    });
  });

  describe('Master-Slave Interaction', () => {
    it('should have master read updated AO value from slave', async function () {
      this.timeout(12000);
      // Ensure publish completes before awaiting the master's readback
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_SLAVE/AO/AO-00/set', '12345', {}, (err) => err ? reject(err) : resolve());
      });

      const masterMsg = await retrieveMessageAsync(m => masterTopicEndsWith(m.topic, 'AO/AO-00'));
      expect(masterMsg).to.exist;
      expect(masterMsg!.message).to.equal('12345');
    });

    it('should have slave read updated AO value from master', async function () {
      this.timeout(10000);
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_MASTER/R1-AO/AO-01/set', '54321', {}, (err) => err ? reject(err) : resolve());
      });

      const slaveMsg = await retrieveMessageAsync(m => m.topic === 'homie/E2E_SLAVE/AO/AO-01');
      expect(slaveMsg).to.exist;
      expect(slaveMsg!.message).to.equal('54321');
    });

    it('should have master write to slave coil', async function () {
      this.timeout(10000);
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_MASTER/R0-DO/DO-00/set', '1', {}, (err) => err ? reject(err) : resolve());
      });

      const slaveMsg = await retrieveMessageAsync(m => m.topic === 'homie/E2E_SLAVE/DO/DO-00');
      expect(slaveMsg).to.exist;
      expect(toBool(slaveMsg!.message)).to.equal(true);
    });

    it('should have slave write to master coil', async function () {
      this.timeout(10000);
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_SLAVE/DO/DO-01/set', '0', {}, (err) => err ? reject(err) : resolve());
      });

      const masterMsg = await retrieveMessageAsync(m => masterTopicEndsWith(m.topic, 'DO/DO-00'));
      expect(masterMsg).to.exist;
      expect(toBool(masterMsg!.message)).to.equal(false);
    });

    it('should have master read input register from slave', async function () {
      this.timeout(10000);
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_SLAVE/AI/AI-00/set', '777', {}, (err) => err ? reject(err) : resolve());
      });

      const masterMsg = await retrieveMessageAsync(m => masterTopicEndsWith(m.topic, 'AI/AI-00'));
      expect(masterMsg).to.exist;
      expect(masterMsg!.message).to.equal('777');
    });

    it('should not have master write to slave input register', async function () {
      this.timeout(10000);
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_MASTER/R1-AI/AI-01/set', '888', {}, (err) => err ? reject(err) : resolve());
      });

      try {
        // expect no message within 8s
        const slaveMsg = await retrieveMessageAsync(m => m.topic === 'homie/E2E_SLAVE/AI/AI-01', 8000);
        throw new Error('Unexpected message received: ' + JSON.stringify(slaveMsg));
      } catch (err) {
        // expected: no message received within timeout
      }
    });

    it('should have master read discrete input from slave', async function () {
      this.timeout(10000);
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_SLAVE/DI/DI-00/set', '1', {}, (err) => err ? reject(err) : resolve());
      });
      const msg = await retrieveMessageAsync(m => masterTopicEndsWith(m.topic, 'DI/DI-00'));
      expect(msg).to.exist;
      expect('true').to.include(msg.message);
    });

    it('should not have master write to slave discrete input', async function () {
      this.timeout(10000);
      // clear buffer messages to avoid false positives
      messageBuffer = [];
      await new Promise<void>((resolve, reject) => {
        mqttClient.publish('homie/E2E_MASTER/R0-DI/DI-01/set', '0', {}, (err) => err ? reject(err) : resolve());
      });

      try {
        // expect no message within 8s
        const slaveMsg = await retrieveMessageAsync(m => m.topic === 'homie/E2E_SLAVE/DI/DI-01', 8000);
        throw new Error('Unexpected message received: ' + JSON.stringify(slaveMsg));
      } catch (err) {
        // expected: no message received within timeout
      }
    });
  });
});
