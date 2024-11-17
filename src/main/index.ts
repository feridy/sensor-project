import { app, shell, BrowserWindow, ipcMain } from 'electron';
import path, { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { connectMQTTServer } from './handler';
import { MqttClient } from 'mqtt';
import { initMainLog } from './log';
// import * as csv from 'fast-csv';
// import dayjs from 'dayjs';
import fs from 'fs-extra';
import { spawn } from 'child_process';

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
  const receiveAccDataSensorIds = new Set<number>();

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
      async (id: number) => {
        receiveAccDataSensorIds.add(id);
        console.log('collectAccDataSensorIds:', [...collectAccDataSensorIds]);
        console.log('receive acc data sensor no. -', id);
        // 全部数据收集完成后将数据保存到csv文件中
        if (collectAccDataSensorIds.size === receiveAccDataSensorIds.size) {
          const args = [...receiveAccDataSensorIds].map((item) =>
            join(process.cwd(), `./temp/${item}`)
          );
          await fs.ensureDir(join(process.cwd(), './temp'));
          // 执行python脚本
          const childProcess = spawn(path.join(process.cwd(), './.venv/bin/python'), [
            join(process.cwd(), './libs/save_acc.py'),
            args.join(',')
          ]);
          childProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
            try {
              const json = JSON.parse(data);
              // 处理结果
              mainWindow.webContents.send('RECEIVE_ACC_HANDLE_RESULT', JSON.stringify(json));
            } catch (error) {
              console.log(error);
            }
          });
          childProcess.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
            mainWindow.webContents.send('RECEIVE_ACC_Fail', data);
          });
          childProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            if (code === 0) {
              console.log('子进程执行成功');
              // 完成了采集的数据的回传
              mainWindow.webContents.send(
                'RECEIVE_ACC_SUCCESS',
                JSON.stringify(receiveAccDataSensorIds)
              );
              args.forEach(async (item) => {
                fs.remove(item);
              });
            } else {
              console.error(`子进程执行失败，退出码：${code}`);
            }

            mainWindow.webContents.send(
              'RECEIVE_ACC_COMPLETE',
              JSON.stringify(receiveAccDataSensorIds)
            );
            args.forEach(async (item) => {
              fs.remove(item);
            });

            collectAccDataSensorIds.clear();
            receiveAccDataSensorIds.clear();
          });
          childProcess.on('error', (e) => {
            console.log(e);
          });
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
  // 触发展示曲线的图
  ipcMain.handle('SHOW_PLOT', (_, src: string) => {
    const childProcess = spawn(
      path.join(process.cwd(), './.venv/bin/python'),
      // join(process.cwd(), `./libs/${process.platform === 'win32' ? 'plot.exe' : 'plot'}`),
      [path.join(process.cwd(), './libs/plot.py'), join(process.cwd(), src)]
    );
    childProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    childProcess.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
    childProcess.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      if (code === 0) {
        console.log('子进程关闭');
      } else {
        console.error(`子进程执行失败，退出码：${code}`);
      }

      mainWindow.webContents.send('ACC_PLOT_CLOSE', src);
    });
    childProcess.on('error', (e) => {
      console.log(e);
    });
  });
  // 触发了刷新就要重置回传的数组
  ipcMain.handle('RENDER_REFRESH', () => {
    receiveAccDataSensorIds.clear();
    collectAccDataSensorIds.clear();
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
