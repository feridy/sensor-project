import { contextBridge } from 'electron';
// import fs from 'fs-extra';
import path from 'path';
import url from 'url';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  initMQTTClient: async () => {
    await electronAPI.ipcRenderer.invoke('INIT_MQTT');
  },
  getFilePath: (src: string) => {
    const filePath = path.join(process.cwd(), src);
    // 将文件路径转换为 file:// 协议的路径
    const fileUrl = url.pathToFileURL(filePath).href;

    console.log(fileUrl);

    return fileUrl;
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
