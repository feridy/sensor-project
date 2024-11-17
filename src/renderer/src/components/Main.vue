<script setup lang="ts">
import { Row, Col, Checkbox, Button, Space, Empty, Modal, message, Spin } from 'ant-design-vue';
import { SyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue';
import { onMounted, ref, h, createVNode } from 'vue';
// import D3 from './D3.vue';
const onLineIds = ref<Record<number, number>>({});
const selectSensors = ref<number[]>([]);
const sensors = ref<number[]>([]);
const isHandling = ref(false);
const accProcessUrl = ref('');
const accImage = ref('');

function showStatusText(status: number) {
  if (status === 1) {
    return '在线';
  }
  if (status === 2) {
    return '开始配置';
  }
  if (status == 3) {
    return '配置完成';
  }
  if (status === 4) {
    return '开始采集';
  }
  if (status === 5) {
    return '采集结束';
  }
  if (status === 6) {
    return '开始传输';
  }
  if (status === 7) {
    return '传输结束';
  }

  if (!status) {
    return '离线';
  } else {
    return '在线';
  }
}
function refresh() {
  window.location.reload();
}
function sendGatherCommand() {
  if (!selectSensors.value.length) {
    message.error('没有选中传感器');
    return;
  }
  Modal.confirm({
    title: '是否想发送采集命令?',
    icon: createVNode(ExclamationCircleOutlined),
    content: '发送采集指令，来进行数据收集',
    onOk() {
      return new Promise((resolve) => {
        if (
          selectSensors.value.length ===
          sensors.value.filter((item) => onLineIds.value[item]).length
        ) {
          window.electron.ipcRenderer.invoke('SEND_GATHER_DATA', 'ff');
        } else {
          // 每个处理
          selectSensors.value.forEach((item) => {
            window.electron.ipcRenderer.invoke(
              'SEND_GATHER_DATA',
              item.toString(16).padStart(2, '0')
            );
          });
        }
        setTimeout(resolve, 1000);
      }).catch(() => console.log('Oops errors!'));
    },
    onCancel() {
      // 取消
    }
  });
}
function sendPassBackCommand() {
  if (isHandling.value) {
    message.error('上次回传还未完成，请稍等...');
    return;
  }
  if (!selectSensors.value.length) {
    message.error('没有选中传感器');
    return;
  }
  let timeId = -1;
  const list = [...selectSensors.value];
  Modal.info({
    title: '是否想发送回传命令?',
    icon: createVNode(ExclamationCircleOutlined),
    content: '发送回传指令，将等待数据的传输',
    closable: false,
    keyboard: false,
    onOk() {
      return new Promise((resolve) => {
        // 每个处理
        const item = list.shift();
        if (item) {
          window.electron.ipcRenderer.invoke(
            'COLLECT_ACC_DATA',
            item.toString(16).padStart(2, '0')
          );
        }
        accProcessUrl.value = '';
        accImage.value = '';
        // 等待数据回传，如时间设定较短可能造成网络拥堵
        timeId = setInterval(() => {
          const item = list.shift();
          if (item) {
            window.electron.ipcRenderer.invoke(
              'COLLECT_ACC_DATA',
              item.toString(16).padStart(2, '0')
            );
          } else {
            clearInterval(timeId);
            setTimeout(resolve, 1000);
          }
        }, 1000) as unknown as number;
      }).catch(() => console.log('Oops errors!'));
    },
    afterClose() {
      isHandling.value = true;
      clearInterval(timeId);
    }
  });
}
function showPlot() {
  if (!accProcessUrl.value) {
    message.error('还未获取到回传的数据');
    return;
  }
  window.electron.ipcRenderer.invoke('SHOW_PLOT', accProcessUrl.value);
}

onMounted(async () => {
  for (let i = 1; i <= 100; i++) {
    sensors.value.push(i);
  }
  await window.api.initMQTTClient();
  window.electron.ipcRenderer.on('CHECK_STATE', (_, id: number, status: number) => {
    onLineIds.value[id] = status;
  });

  window.electron.ipcRenderer.on('MQTT_CONNECT', () => {
    window.electron.ipcRenderer.invoke('CHECK_SENSOR_STATE', 'ff');
  });

  window.electron.ipcRenderer.on('RECEIVE_ACC_HANDLE_RESULT', async (_, dataMessage) => {
    console.log(dataMessage);
    const data = JSON.parse(dataMessage);
    if (data.status === 1) {
      accImage.value = window.api.getFilePath(data.acc_image);
      accProcessUrl.value = data.acc_path;
      message.success('回传完成...');
    }
  });

  window.electron.ipcRenderer.on('RECEIVE_ACC_COMPLETE', () => {
    isHandling.value = false;
  });
});
</script>
<template>
  <div class="wrapper">
    <Row style="height: 100%">
      <Col :span="2">
        <div class="sensor-menu">
          <div class="menu-item active">
            <div class="sensor-icon"></div>
            <span>传感器</span>
          </div>
        </div>
      </Col>
      <Col :span="22" style="height: 100%">
        <Row
          class="container"
          style="height: 100%; border-top-left-radius: 20px; background-color: #fff"
        >
          <Col :span="6" style="height: 100%; padding: 20px 0; box-shadow: 0px 5px 5px #ccc">
            <div
              class="sensor-header"
              style="
                height: 40px;
                border-bottom: 1px solid #ccc;
                padding-left: 10px;
                padding-right: 20px;
              "
            >
              <Checkbox
                :disabled="sensors.filter((item) => onLineIds[item]).length === 0"
                :checked="
                  selectSensors.length > 0 &&
                  selectSensors.length === sensors.filter((item) => onLineIds[item]).length
                "
                :indeterminate="
                  selectSensors.length > 0 &&
                  selectSensors.length < sensors.filter((item) => onLineIds[item]).length
                "
                @change="
                  (e) => {
                    if (e.target.checked) {
                      selectSensors.length = 0;
                      sensors
                        .filter((item) => onLineIds[item])
                        .forEach((item) => {
                          selectSensors.push(item);
                        });
                    } else {
                      selectSensors.length = 0;
                    }
                  }
                "
              >
                全选
              </Checkbox>
              <div style="display: flex; align-items: center"></div>
            </div>
            <ul style="height: calc(100% - 40px); overflow-y: auto">
              <li
                v-for="item in sensors"
                :key="item"
                class="sensor-item"
                style="
                  height: 40px;
                  margin: 4px 0;
                  line-height: 40px;
                  padding-left: 10px;
                  padding-right: 20px;
                "
              >
                <Checkbox
                  :checked="selectSensors.includes(item)"
                  :disabled="!onLineIds[item]"
                  @change="
                    (e) => {
                      if (!e.target.checked) {
                        const index = selectSensors.indexOf(item);
                        selectSensors.splice(index, 1);
                      } else {
                        selectSensors.push(item);
                        console.log(item);
                      }
                    }
                  "
                >
                  传感器-{{ item.toString().padStart(2, '0') }}
                </Checkbox>
                <div class="sensor-status" :class="onLineIds[item] ? 'online' : 'offline'">
                  <span>{{ showStatusText(onLineIds[item]) }}</span>
                  <span class="status-icon"></span>
                </div>
              </li>
            </ul>
          </Col>
          <Col style="height: 100%" :span="18">
            <Row>
              <Col
                :span="24"
                style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 10px 20px;
                "
              >
                <Space>
                  <span style="color: #333">传感器波形展示</span>
                  <Button :icon="h(SyncOutlined)" @click="refresh">刷新</Button>
                </Space>
                <Space>
                  <Button type="primary" @click="sendGatherCommand">采集</Button>
                  <Button type="primary" @click="sendPassBackCommand">回传</Button>
                  <!-- <Button type="primary">下发指令</Button> -->
                  <Button type="primary" @click="showPlot">查看波形文件</Button>
                </Space>
              </Col>
            </Row>
            <Row style="height: calc(100% - 50px)">
              <Col :span="24" style="height: 100%; padding: 20px">
                <div
                  style="
                    position: relative;
                    border: 1px solid #ccc;
                    border-radius: 8px;
                    height: 100%;
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  "
                >
                  <!-- <D3 v-if="accProcessUrl" :url="accProcessUrl" />/ -->
                  <img
                    v-if="accImage"
                    style="width: 100%; height: 100%; object-fit: contain"
                    :src="accImage"
                  />
                  <Empty v-else style="color: #ccc" />
                  <div
                    v-if="isHandling"
                    style="
                      position: absolute;
                      inset: 0;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      background-color: rgba(0, 0, 0, 0.8);
                      z-index: 999;
                    "
                  >
                    <Spin :spinning="true" tip="Handling..." />
                  </div>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Col>
    </Row>
  </div>
</template>

<style lang="scss" scoped>
.wrapper {
  width: 100vw;
  height: 100vh;
  background-color: #3d557a;
  overflow-y: auto;

  .sensor-menu {
    padding-top: 20px;
    display: flex;
    flex-flow: column nowrap;
    align-items: center;
    width: 100%;
    height: 100%;
    .menu-item {
      display: flex;
      width: 60px;
      height: 60px;
      cursor: pointer;
      flex-flow: column nowrap;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background-color: #2b3e5c;
      font-size: 14px;
      font-weight: bold;
      color: #fff;
      &.active {
        .sensor-icon {
          background-image: url('../assets/sensor_icon_active.png');
        }
      }
    }

    .sensor-icon {
      width: 34px;
      height: 24px;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      background-image: url('../assets/sensor_icon.png');
    }
  }

  .sensor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sensor-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    &:hover {
      background-color: rgba(0, 0, 0, 0.2);
    }

    .sensor-status {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;

      &.online {
        color: #00ff00;
        .status-icon {
          background-color: #00ff00;
        }
      }
      &.offline {
        color: #ccc;
        .status-icon {
          background-color: #ccc;
        }
      }
      .status-icon {
        margin-left: 4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
    }
  }

  .title {
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
</style>
