FROM node:20-alpine

WORKDIR /app
COPY package.json /app
RUN npm install

COPY . /app
CMD node ModbusSimulator.js

EXPOSE 502/udp
EXPOSE 502/tcp