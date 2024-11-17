import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      initMQTTClient: () => Promise<void>;
      getFilePath: (src: string) => string;
    };
  }
}
