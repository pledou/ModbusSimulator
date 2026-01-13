// @ts-check
'use strict';

const pjson = require('./package.json');
const Master = require('./src/core/master');
const Slave = require('./src/core/slave');
const { config, runInPKG } = require('./src/config/config');
const MASTER_CONFIGFILE = config.master && config.master.script && typeof config.master.script === 'string'
  ? './' + config.master.script
  : null; //par défaut pas de script spécifique
const SLAVE_CONFIGFILE = config.slave && config.slave.script && typeof config.slave.script === 'string'
  ? './' + config.slave.script
  : null; //par défaut pas de script spécifique
const path = require('path');

//add MQTT capacities
const HomieDevice = require('homie-device');
let mqtt_client = null;
let slv = null;
let mst = null;

process.title = `ModbusSimulator ${config.name}`; //titre de fenetre

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
  let slave_config = require('./src/config/slave_config.js');
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
  let master_config = require('./src/config/master_config.js');
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
