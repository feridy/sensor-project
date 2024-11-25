import sys
import time
import numpy as np
import os
import json
import matplotlib.pyplot as plt
import warnings

# 忽略所有警告
warnings.filterwarnings("ignore")


def sync_without_source(acc_all_data, time_all_data):
    acc_data = acc_all_data
    time_data = time_all_data
    channel_num = time_data.size
    acc_num = 40000

    tim_max = time_data.max()
    tim_offset = tim_max - time_data
    sample_offset = np.round(tim_offset / 125)
    # print(sample_offset)

    acc = np.ones((acc_num, channel_num))

    for i in range(channel_num):
        acc[: acc_num - int(sample_offset[i]), i] = acc_data[
            int(sample_offset[i]) : acc_num, i
        ]
        acc[acc_num - int(sample_offset[i]) : acc_num, i] = acc[
            acc_num - 2 * int(sample_offset[i]) : acc_num - int(sample_offset[i]), i
        ]
        acc[:, i] = acc[:, i] - acc[:, i].mean()

    return acc


def sync_with_source(acc_all_data, time_all_data):
    acc_data = acc_all_data[:, 1:]  # 获得除第0通道外其他所有加速度数据
    time_data = time_all_data[1:]  # 获得除第0通道外其他所有采集时刻数据
    t_start = time_all_data[0]  # 获得第0通道的激发时刻数据
    channel_num = time_data.size
    acc_num = 40000

    tim_max = time_data.max()
    tim_offset = tim_max - time_data
    sample_offset = np.round(tim_offset / 125)
    # print(sample_offset)

    acc = np.ones((acc_num, channel_num))

    for i in range(channel_num):
        acc[: acc_num - int(sample_offset[i]), i] = acc_data[
            int(sample_offset[i]) : acc_num, i
        ]
        acc[acc_num - int(sample_offset[i]) : acc_num, i] = acc[
            acc_num - 2 * int(sample_offset[i]) : acc_num - int(sample_offset[i]), i
        ]
        acc[:, i] = acc[:, i] - acc[:, i].mean()

    tim_offset_start_max = t_start - tim_max
    sample_offset_start_max = int(np.round(tim_offset_start_max / 125))

    acc_cut = acc[
        sample_offset_start_max - 2000 : sample_offset_start_max + 14000, :
    ]  # acc_cut是处理后的最终数据

    return acc_cut


# 访问特定参数（例如，第一个参数，注意索引从0开始）
if len(sys.argv) > 1:
    # 输入的传感器的编号字符传的
    first_arg = sys.argv[1]
    os.makedirs("./temp", exist_ok=True)
    sensor_file = first_arg.split(",")
    channel_num = len(sensor_file)
    acc_num = 40000
    data_flag = np.zeros(channel_num)
    acc_data = 10 * np.ones((acc_num, channel_num))
    time_data = np.ones(channel_num, dtype=np.int64)
    for j in range(channel_num):
        with open(sensor_file[j], "rb") as file:
            binary_content = file.read()
        channel_count = binary_content[-1]  # 获得传感器编号

        for i in range(acc_num):  # 对加速度数据进行解编
            acc_temp = int.from_bytes(
                binary_content[3 * i : 3 * i + 3], byteorder="little"
            )
            if acc_temp >= 8388608:
                a = (acc_temp - 16777216) / 3750000
            else:
                a = acc_temp / 3750000
            acc_data[i, j] = a  # 将解编后的加速度数据存入加速度数据数组
        t = int.from_bytes(
            binary_content[-9:-1], byteorder="little"
        )  # 对采集时刻数据进行解编
        time_data[j] = t  # 将解编后的采集时刻数据存入采集时刻数组

        data_flag[j] = 1  # 将对应通道的回传标签置1

    # 判断所有数据是否都已经回传成功，如成功则保存加速度和采集时刻数据
    if data_flag.sum() == channel_num:
        acc = sync_without_source(acc_all_data=acc_data, time_all_data=time_data)
        if len(sys.argv) >= 3:
            transfer_time = sys.argv[2]
        else:
            transfer_time = time.strftime("%Y_%m_%d_%H_%M_%S", time.localtime())
        if len(sys.argv) >= 4:
            output_path = sys.argv[3]
        else:
            output_path = "./temp/figure" + transfer_time + ".png"
        np.savetxt("./temp/acc" + transfer_time + ".csv", acc_data, delimiter=",")
        np.savetxt("./temp/time" + transfer_time + ".csv", time_data, delimiter=",")
        np.savetxt("./temp/acc_processed_" + transfer_time + ".csv", acc, delimiter=",")
        acc_tran = np.transpose(acc)
        plt.plot(acc)
        plt.savefig(output_path)
        data = {
            "status": 1,
            "acc_image": output_path,
            "acc_path": "./temp/acc" + transfer_time + ".csv",
            "time_path": "./temp/time" + transfer_time + ".csv",
            "acc_processed": "./temp/acc_processed_" + transfer_time + ".csv",
        }
        json_string = json.dumps(data)
        plt.close("all")
        print(json_string)
else:
    # print("No arguments provided.")
    data = {"status": 0, "message": "No arguments provided."}
    json_string = json.dumps(data)
    print(json_string)
    # exit()
