import { app, shell, BrowserWindow, ipcMain } from 'electron';
import path, { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { connectMQTTServer } from './handler';
import { MqttClient } from 'mqtt';
import { initMainLog } from './log';
import * as csv from 'fast-csv';
import dayjs from 'dayjs';
import fs from 'fs-extra';

initMainLog();

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  let MQTT_CLIENT: MqttClient | null = null;

  // 要进行回传的传感器id的列表
  const collectAccDataSensorIds = new Set<number>();
  const accDataTemp: number[][] = [];
  const collectTimeTemp: number[] = [];
  let sensorAccDataTempIndex: Record<number, number> = {};

  // mqtt的处理
  ipcMain.handle('INIT_MQTT', async () => {
    console.log('------进行MQTT客户端连接------');
    connectMQTTServer(
      (payload: string) => {
        // 传感器状态的处理
        const buf = Buffer.from(payload, 'hex');
        const sensorNo = buf.subarray(0, 1)[0];
        const sensorStatus = buf.subarray(-1)[0];
        mainWindow.webContents.send('CHECK_STATE', sensorNo, sensorStatus);
      },
      (client) => {
        mainWindow.webContents.send('MQTT_CONNECT');
        MQTT_CLIENT = client;
      },
      (id, acc, time) => {
        // 如果是手动触发的，收到数据就在列表中移除
        if (collectAccDataSensorIds.has(id)) {
          if (collectTimeTemp[id] !== undefined) {
            accDataTemp.splice(sensorAccDataTempIndex[id], 1, acc);
            collectTimeTemp.splice(sensorAccDataTempIndex[id], 1, time);
          } else {
            // const a: [number][] = acc.map((item) => [item]);
            const len = accDataTemp.push(acc);
            collectTimeTemp.push(time);
            sensorAccDataTempIndex[id] = len - 1;
          }
        }
        // 全部数据收集完成后将数据保存到csv文件中
        if (
          accDataTemp.length &&
          collectAccDataSensorIds.size === [...collectTimeTemp.values()].length
        ) {
          const transferTime = dayjs().format('YYYY-MM-DD_HH_mm_ss');
          const savePath = path.join(process.cwd(), `./temp/acc_raw_${transferTime}.csv`);
          const stream = fs.createWriteStream(savePath);
          const count = collectAccDataSensorIds.size;
          const data: number[][] = [];
          const length = Math.max(...accDataTemp.map((item) => item.length));
          for (let i = 0; i < length; i++) {
            const a: number[] = [];
            accDataTemp.forEach((item) => {
              a.push(item[i] || 0);
            });

            data[i] = a;
          }
          csv
            .writeToStream(stream, data, { headers: false, delimiter: ',' })
            .on('finish', () => {
              console.log(`一共${count}加速度的CSV 文件已保存到 ${savePath}`);
            })
            .on('error', (err) => {
              console.error('写入 CSV 文件时出错:', err);
            });
          const timePath = path.join(process.cwd(), `./temp/time_raw_${transferTime}.csv`);
          const timeStream = fs.createWriteStream(timePath);
          csv
            .writeToStream(
              timeStream,
              collectTimeTemp.map((item) => [item]),
              { headers: false, delimiter: ',' }
            )
            .on('finish', () => {
              console.log(`时间的CSV文件已保存到 ${savePath}`);
            })
            .on('error', (err) => {
              console.error('写入 CSV 文件时出错:', err);
            });

          collectTimeTemp.length = 0;
          accDataTemp.length = 0;
          collectAccDataSensorIds.clear();
          sensorAccDataTempIndex = {};
        }
      }
    );
  });
  // 触发状态的指令
  ipcMain.handle('CHECK_SENSOR_STATE', (_, id: string) => {
    MQTT_CLIENT?.publish('/geophone/command', Buffer.from(`${id}0301`, 'hex'));
  });
  // 触发回传数据的指令
  ipcMain.handle('COLLECT_ACC_DATA', (_, id: string) => {
    // 重置内存
    // accDataTemp.length = 0;
    // collectTimeTemp.length = 0;
    // collectAccDataSensorIds.add(id);
    // 针对全部的处理
    if (id.toLowerCase() === 'ff') {
      for (let i = 1; i <= 100; i++) {
        collectAccDataSensorIds.add(i);
      }
    } else {
      collectAccDataSensorIds.add(Number(id));
    }
    console.log(`------COLLECT_ACC_DATAtopic: /geophone/command, command: ${id}0201 --------`);
    MQTT_CLIENT?.publish('/geophone/command', Buffer.from(`${id}0202`, 'hex'));
  });
  // 触发采集指令
  ipcMain.handle('SEND_GATHER_DATA', (_, id: string) => {
    console.log(`------SEND_GATHER_DATA topic: /geophone/command, command: ${id}0201 --------`);
    MQTT_CLIENT?.publish('/geophone/command', Buffer.from(`${id}0201`, 'hex'));
  });
  // 触发自定义指令
  ipcMain.handle('SEND_CUSTOM_COMMAND', (_, command: string) => {
    console.log(`------SEND_GATHER_DATA topic: /geophone/command, command: ${command} --------`);
    MQTT_CLIENT?.publish('/geophone/command', Buffer.from(command, 'hex'));
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
