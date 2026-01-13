// @ts-check
'use strict';

/**
 * @enum {number}
 */
const FunctionCode = {
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

function setRequest(master, mqttclient){
        const myNode = mqttclient.node('pull', 'Digital Inputs pulls', 'test-node');
        myNode.advertise('jour').setName('Jour de la semaine').setDatatype('string');
        myNode.advertise('date').setName('Date et heure').setDatatype('string');
        master.createTransaction(0, FunctionCode.ReadDiscreteInputs, 8*10 ,500, 0)
        .on('response', function(res){
          let i=0;
          let jour='',s='', mi='', h='', d='', m='',as='',aa='',bs = '';
          for (i =0; i< 8*2; i++){bs+= Number(res.states[i]);}
          for (i =8*2; i< 8*3; i++) {if (res.states[i]) {jour+= (i-8*2+1);}} //jour semaine
          for (i =8*4-1; i>= 8*3 ; i--) {s+= Number(res.states[i]);} //s
          for (i =8*5-1; i>= 8*4; i--) {mi+= Number(res.states[i]);} //mi
          for (i =8*6-1; i>= 8*5; i--) {h+= Number(res.states[i]);} //h
          for (i =8*7-1; i>= 8*6; i--) {d+= Number(res.states[i]);} //d
          for (i =8*8-1; i>= 8*7; i--) {m+= Number(res.states[i]);} //M
          for (i =8*9-1; i>= 8*8; i--) {aa+= Number(res.states[i]);} //aa
          for (i =8*10-1; i>= 8*9; i--) {as+= Number(res.states[i]);} //as
          myNode.setProperty('jour').send(jour);
          myNode.setProperty('date').send(''+parseInt(as,2)+parseInt(aa,2)+'-'+parseInt(m,2)+'-'+parseInt(d,2)+'T'+parseInt(h,2)+':'+parseInt(mi,2)+':'+parseInt(s,2)+'Z');
        }); 
    }

module.exports = setRequest;