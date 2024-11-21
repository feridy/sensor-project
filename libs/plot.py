import matplotlib.pyplot as plt
import numpy as np
import sys
import json

if len(sys.argv) > 1:
    # 要展示曲线的.cvs的路径
    first_arg = sys.argv[1]
    print(first_arg)
    acc = np.loadtxt(first_arg, delimiter=",")
    plt.plot(acc)
    plt.show()
else:
    acc = np.loadtxt(
        "../temp/acc_9_processed.csv",
        delimiter=",",
    )
    # acc_t = np.transpose(acc)
    plt.plot(acc)
    plt.show()

    data = {"status": 0, "message": "No arguments provided."}
    json_string = json.dumps(data)
    print(json_string)
