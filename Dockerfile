FROM node:12-alpine

# https://sanderknape.com/2019/06/installing-private-git-repositories-npm-install-docker/
# RUN apk add git openssh-client

WORKDIR /app
COPY package.json /app

# RUN mkdir -p -m 0600 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts
# RUN --mount=type=ssh,id=github npm install
# RUN npm install

COPY . /app
CMD node ModbusSimulator.js appconfig_MEA_windowsdocker.json

EXPOSE 502/udp