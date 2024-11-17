<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Plotly from 'plotly.js-dist-min';
import * as d3 from 'd3';
const elRef = ref<HTMLDivElement>();

const props = defineProps<{ url: string }>();

async function makeplot() {
  if (!props.url) return;
  const url = window.api.getFilePath(props.url);
  const data = await d3.csv(url);

  processData(data);
}

function processData(allRows: d3.DSVRowArray<string>) {
  console.log(allRows.length);
  const x: any[] = [],
    y: any[] = [],
    standard_deviation = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    allRows.columns.forEach((item) => {
      x.push(item);
      y.push(row[item]);
    });

    // console.log(row);
  }
  makePlotly(x, y, standard_deviation);
}

function makePlotly(x, y, _standard_deviation) {
  const traces = [
    {
      x: x,
      y: y,
      mode: 'lines', // 使用曲线模式绘制
      type: 'scattergl', // 关键：使用 scattergl 类型来启用 WebGL
      line: {
        color: 'steelblue', // 曲线颜色
        width: 1 // 曲线宽度
      }
    }
  ];

  Plotly.newPlot(elRef.value!, traces, {
    title: {
      text: 'ACC曲线'
    }
  });
}

onMounted(() => {
  makeplot();
});
</script>

<template>
  <div ref="elRef" class="wrapper"></div>
</template>

<style lang="scss" scoped>
.wrapper {
  width: 100%;
  height: 100%;
}
</style>
