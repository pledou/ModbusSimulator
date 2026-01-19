// @ts-nocheck
'use strict';

import pjson from './package.json' assert { type: 'json' };
import Master from './src/core/master.js';
import Slave from './src/core/slave.js';
// @ts-ignore - TODO: fix variable name conflict with master_config
import configDefault from './src/config/config.js';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const config = configDefault.config;
const runInPKG = configDefault.runInPKG;

const MASTER_CONFIGFILE = config.master && config.master.script && typeof config.master.script === 'string'
  ? './' + config.master.script
  : null; //par défaut pas de script spécifique
const SLAVE_CONFIGFILE = config.slave && config.slave.script && typeof config.slave.script === 'string'
  ? './' + config.slave.script
  : null; //par défaut pas de script spécifique

//add MQTT capacities
const HomieDevice = require('homie-device');
let mqtt_client = null;
let slv = null;
let mst = null;

process.title = `ModbusSimulator ${config.name}`; //titre de fenetre

async function main() {
  if (config.mqtt) {
    if (config.device_id === undefined) { config.device_id = config.name.replace(" ", "-"); }
    config.mqtt = Object.assign({
      "host": "localhost",
      "port": 1883,
      "base_topic": "homie/",
      "auth": false,
      "username": null,
      "password": null
    },config.mqtt); //Load default options
    mqtt_client = new HomieDevice(config);
    mqtt_client.setFirmware(pjson.name, pjson.version);
  }

  if (config.slave) {
    const slaveConfigModule = await import('./src/config/slave_config.js');
    let slave_config = slaveConfigModule.default;
    slv = new Slave(config.slave);//initialisation de l'esclave
    if (config.slave.data) {
      slave_config(slv.UNIT_TO_DATA, mqtt_client); //appel de la config pré-définie en interne
    }
    //Ensuite, en présence d'une demande spécifique dans le fichier de config:
    if (SLAVE_CONFIGFILE) {
      if (runInPKG) {
        const deployPath = path.dirname(process.execPath);
        slave_config = require(path.join(deployPath, SLAVE_CONFIGFILE));
      }
      else {
        slave_config = require(SLAVE_CONFIGFILE);
      }
      slave_config(slv.UNIT_TO_DATA, mqtt_client);
    }
  }
  if (config.master) {
    const masterConfigModule = await import('./src/config/master_config.js');
    let master_config = masterConfigModule.default;
    mst = new Master(config.master);
    if (config.master.requests) {
      master_config(mst, mqtt_client); //appel de la config pré-définie en interne
    }
    //Ensuite, en présence d'une demande spécifique dans le fichier de config:
    if (MASTER_CONFIGFILE) {
      if (runInPKG) {
        const deployPath = path.dirname(process.execPath);
        master_config = require(path.join(deployPath, MASTER_CONFIGFILE));
      }
      else {
        master_config = require(MASTER_CONFIGFILE);
      }

      master_config(mst, mqtt_client);
    }
  }
}

process.once("SIGINT", exit());
process.once("SIGHUP", exit());
process.once("SIGTERM", exit());

function exit() {
  return () => {
    if (mqtt_client) {
      mqtt_client.end();
      if (slv){slv.listener.destroy();}
      if (mst){mst.master.destroy();}
    }
  };
}

main().catch(err => {
  console.error('Initialization error:', err);
  process.exit(1);
});
