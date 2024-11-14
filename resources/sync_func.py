import numpy as np


def sync_without_source(acc_all_data, time_all_data):
    acc_data = acc_all_data
    time_data = time_all_data
    channel_num = time_data.size
    acc_num = 40000

    tim_max = time_data.max()
    tim_offset = tim_max - time_data
    sample_offset = np.round(tim_offset / 125)
    print(sample_offset)

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
    print(sample_offset)

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
