import log from 'electron-log/main';
import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';

export function initMainLog() {
  // 保存已满的文件备份
  log.transports.file.archiveLogFn = (file) => {
    const info = path.parse(file.path);
    const files = fs.readdirSync(info.dir);
    fs.renameSync(file.path, `${info.dir}/${info.name}.${files.length - 1}.${info.ext}`);
  };

  // 自定义日志的保存位置
  log.transports.file.resolvePathFn = () => {
    // console.log(__dirname);
    return path.join(process.cwd(), '/logs', dayjs().format('YYYY-MM-DD') + '.log');
  };

  const mainLog = log.scope('Main');
  log.initialize();
  Object.assign(console, mainLog);

  mainLog.info('..........开始启动程序..........');

  return mainLog;
}
