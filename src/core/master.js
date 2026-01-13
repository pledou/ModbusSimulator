// @ts-check
// Part of <http://miracle.systems/p/modbus-master> licensed under <MIT>

'use strict';

const modbus = require('h5.modbus');
const CONCURRENT_TRANSACTIONS = 20;
const DEFAULT_UNIT = 1;
const stats = require('./stats');

/**
 * Master implementation of modbus tcp-udp simulator
 */
class MasterSimulator {
  constructor(options) {
    this.DEBUG = options.debug;
    this.STATS = options.stats;
    this.connection = this.setUpConnection(options);
    this.transport = this.setUpTransport(options);
    this.master = new modbus.Master({
      transport: this.transport,
      connection: this.connection,
      maxConcurrentTransactions: options.concurrent_transactions && typeof options.concurrent_transactions
        ?options.concurrent_transactions
        :CONCURRENT_TRANSACTIONS,
      defaultUnit: options.unit_id && typeof options.unit_id ==='number'
        ? options.unit_id
        :DEFAULT_UNIT,
      defaultMaxRetries: 0
    });
    this.master.on('error', err => console.log('[master error]', err.message));
    this.master.on('open', () => console.log('[master open]'));
    this.master.on('close', () => console.log('[master close]'));

    if (this.DEBUG) {
      this.connection.on('data', data => console.log('[master rx]', data));
      this.connection.on('write', data => console.log('[master tx]', data));
    }

    if (global.gc) {
      setInterval(global.gc, 60000);
    }

    this.master.on('open', stats.reset.bind(stats));

    this.master.once('open', function () {
      if (this.STATS) {
        setInterval(stats.show.bind(stats), 1000);
      }

      //this.setTransactions();
    }.bind(this));
  }

  /**
   * Parametrer le transport
   * @param {*} options 
   * @returns {*} parametered transport according to options
   */
  setUpTransport(options) {
    switch (options.type){
      case 'serial-ascii':
        return new modbus.AsciiTransport(this.connection);
      case 'serial-rtu':
        return new modbus.RtuTransport(this.connection);
      default:
        return new modbus.IpTransport(this.connection);
    }
  }

  /**
   * Parametrer la connexion
   * @param {*} options
   * @returns {*} parametered connection according to options
   */
  setUpConnection(options) {
    let connection = null;
    switch (options.type) {
      case 'udp':
        connection = new modbus.UdpConnection({ socketOptions: options.socketOptions });
        break;
      case 'tcp':
        connection = new modbus.TcpConnection({ socketOptions: options.socketOptions });
        break;
      case 'serial-ascii':
      case 'serial-rtu':
        connection = new modbus.SerialConnection({
          path: options.path,
          serialPortOptions: options.serialPortOptions
        });
        break;
      default:
        throw new Error("type must be 'udp', 'tcp', 'serial-ascii' or 'serial-rtu'");
    }
    return connection;
  }

  /**
   * Start a new transaction
   * @param {(import('h5.modbus/lib/Transaction').TransactionOptions)} options to request
   * @returns {modbus.Transaction} transaction created
   */
  createTransaction(options) {
    const transaction = this.master.execute(options);

    transaction.on('error', this.onError);
    transaction.on('request', this.onRequest);
    transaction.on('response', this.onResponse);
    return transaction;
  }

  /**
   * @param {*} err 
   */
  onError(err) {
    //always log errors on console
    console.log(`${this.id}: ${err.message}`);
    ++stats.err;
  }

  /**
   * 
   * @param {*} id 
   */
  onRequest(id) {
    if (this.DEBUG) {
      console.log(`${this.id}... ${id}... @ ${new Date().toISOString()}`);
    }
    ++stats.req;
  }

  /**
   * 
   * @param {*} res 
   */
  onResponse(res) {
    if (this.DEBUG) {
      console.log(`${this.id}: ${res}`);
    }
    ++stats.req;
  }
}

module.exports = MasterSimulator;
