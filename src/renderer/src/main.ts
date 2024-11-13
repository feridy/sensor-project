import './assets/main.css';
import 'ant-design-vue/dist/reset.css';
import log from 'electron-log/renderer';

import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');

const rendererLog = log.scope('Render');

Object.assign(console, rendererLog);

console.log('render start');
