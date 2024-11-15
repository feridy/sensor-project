import { connect } from 'mqtt';
import type { MqttClient } from 'mqtt';
import path from 'path';
import fs from 'fs-extra';

const host = '127.0.0.1';

// const accNum = 40000;

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
  onGeoPhoneData?: (payload: number) => void
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
      const channel = payload.subarray(-1)[0];
      // const time = payload.subarray(-9, -1).readUIntLE(0, 6);
      // 写入数据写入到本地文件中，为了接下来的python脚本程序使用
      await fs.ensureDir(path.join(process.cwd(), './temp'));
      await fs.writeFile(path.join(process.cwd(), `./temp/${channel}`), payload);

      onGeoPhoneData?.(channel);
    }
  });

  return client;
}
