import { connect } from 'mqtt';
import type { MqttClient } from 'mqtt';
import path from 'path';
import fs from 'fs-extra';

const host = '127.0.0.1';

const accNum = 40000;

function mockData() {
  const buf = fs.readFileSync(path.join(process.cwd(), './test/data1.txt'), 'utf-8');
  const codes: number[] = [];
  for (let i = 0; i < buf.length / 2; i++) {
    const hex = buf.slice(2 * i, i * 2 + 2);
    const code = parseInt(hex, 16);
    codes.push(code);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = Buffer.from(codes as unknown as any, 'hex');

  return payload;
}

export function connectMQTTServer(
  onGeoPhoneStatus?: (payload: string) => void,
  onConnect?: (client: MqttClient) => void,
  onGeoPhoneData?: (id: number, accAllData: number[], timeData: number) => void
) {
  const client = connect(
    !import.meta.env.DEV
      ? { host, port: 1883, keepalive: 600 }
      : {
          hostname: 'broker.emqx.io',
          port: 1883,
          keepalive: 600
        }
  );

  // 连接成功的事件处理
  client.on('connect', () => {
    console.log('connected success ...');
    // 连接成功 开启订阅
    client.subscribe({
      '/geophone/status': { qos: 1 },
      '/geophone/data': { qos: 1 }
    });

    onConnect?.(client);
  });

  // 获取到数据状态
  client.on('message', async (topic, payload) => {
    // 如果状态的的topic的处理
    if (topic === '/geophone/status') {
      onGeoPhoneStatus?.(payload.toString('hex'));
    }
    // 收集数据的处理
    if (topic === '/geophone/data') {
      if (import.meta.env.DEV) payload = mockData();
      const accData: number[] = [];
      // 打印传感器编号
      const channel = payload.subarray(-1)[0];
      const time = payload.subarray(-9, -1).readUIntLE(0, 6);

      for (let i = 0; i < accNum; i++) {
        const accTemp = payload.subarray(3 * i, 3 * i + 3).readUIntLE(0, 3);
        let a = 0;
        if (accTemp >= 8388608) {
          a = (accTemp - 16777216) / 3750000;
        } else {
          a = accTemp / 3750000;
        }

        accData.push(a);
      }

      onGeoPhoneData?.(channel, accData, time);
    }
  });

  return client;
}
