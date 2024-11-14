// 假设只处理逗号列分隔符

export function csvToArray(csv: string, delimiter: string): string[][] {
  const table = [] as string[][];
  let row: string[] = [];
  let cell = '';
  let openQuote = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    pushCell();
    table.push(row);
    row = [];
  };
  // 处理行分隔符和列分隔符
  const handleSeparator = (i: number) => {
    const c = csv.charAt(i);
    if (c === delimiter) {
      pushCell();
    } else if (c === '\r') {
      if (csv.charAt(i + 1) === '\n') {
        i++;
      }
      pushRow();
    } else if (c === '\n') {
      pushRow();
    } else {
      return false;
    }
    return true;
  };

  while (i < csv.length) {
    const c = csv.charAt(i);
    const next = csv.charAt(i + 1);
    if (!openQuote && !cell && c === '"') {
      // 遇到单元第一个字符为双引号时假设整个单元都是被双引号括起来
      openQuote = true;
    } else if (openQuote) {
      // 双引号还未成对的时候
      if (c !== '"') {
        // 如非双引号，直接添加进单元内容
        cell += c;
      } else if (next === '"') {
        // 处理双引号转义
        cell += c;
        i++;
      } else {
        // 确认单元结束
        openQuote = false;
        if (!handleSeparator(++i)) {
          throw new Error('Wrong CSV format!');
        }
      }
    } else if (!handleSeparator(i)) {
      // 没有双引号包起来时，如非行列分隔符，一律直接加入单元内容
      cell += c;
    }
    i++;
  }
  if (cell) {
    pushRow();
  }
  return table;
}
