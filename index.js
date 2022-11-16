const mqtt = require('mqtt')
const host = 'mosquitto'
const port = '1883'
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`
const connectUrl = `mqtt://${host}:${port}`
const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: '',
  password: '',
  reconnectPeriod: 1000,
})
var device_state = {};

const fs = require('fs');
let rawdata = fs.readFileSync('relay-translator.json');
let devices = JSON.parse(rawdata);
console.log(devices);




client.on('connect', () => {
  console.log('Connected')
  sendDescovery();
  subscribeDevices();

  setInterval(() => {
    sendDescovery();
  }, 300000); // 5 min
})


client.on('message', (topic, payload) => {
  newMsg(topic, payload);
})
var mqttTimeout = false;
async function newMsg(topic, payload) {
  console.log('Received Message:', topic, payload.toString())
  devices.forEach(async (device, index) => {

    while (mqttTimeout) {
      await new Promise(resolve => setTimeout(resolve, index*4));
    }

    if (topic == device.command_topic) {
      if (device_state[device.uniq_id] == null) {
        publish(device.relay_topic, device.relay_payload);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (payload != device_state[device.uniq_id]) {
        publish(device.relay_topic, device.relay_payload);
      }
      mqttTimeout = true;
      await new Promise(resolve => setTimeout(resolve, 100));
      mqttTimeout = false;
    }

    if (topic == device.state_topic) {
        device_state[device.uniq_id] = "" + payload;
    }

  });

  if (topic == "homeassistant/status") {
    sendDescovery();
  }
}

function sendDescovery() {
  console.log("send devices for HA discovery");
  devices.forEach(device => {
    publish(`homeassistant/light/relay-translator/${device.uniq_id}/config`, JSON.stringify(device));
  });
}

function subscribeDevices() {
  devices.forEach(device => {
    subscribe(device.command_topic);
    subscribe(device.state_topic);
    device_state[device.uniq_id] = null;
  });

  subscribe("homeassistant/status");
}

function subscribe (topic) {
  client.subscribe([topic], () => {
    console.log(`Subscribe to topic '${topic}'`)
  })
}
function publish(topic, payload) {
  client.publish(topic, payload, { qos: 0, retain: false }, (error) => {
    if (error) {
      console.error(error)
    }
  })
}