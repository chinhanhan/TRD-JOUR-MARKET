const text = `1) 有没有很靠近的snr zone，可能会test到下面?
2) candle close 会不会离开zone很远?
3) 有没有关联的pair 开着单子`;

function parseSopChecklistRules(text) {
  if (!text) return [];
  if (Array.isArray(text)) {
    text = text.join("\n");
  }
  const lines = String(text).split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  
  const numberPrefixRegex = /^(\d+[\.\)]|\u2022|-|\*)\s*/;
  const hasNumbering = lines.some((l) => numberPrefixRegex.test(l));

  if (hasNumbering) {
    const rules = [];
    let currentRule = "";
    for (const line of lines) {
      if (numberPrefixRegex.test(line)) {
        if (currentRule) rules.push(currentRule);
        currentRule = line;
      } else {
        if (currentRule) {
          currentRule += "\n" + line;
        } else {
          currentRule = line;
        }
      }
    }
    if (currentRule) rules.push(currentRule);
    return rules;
  }

  return lines;
}

console.log(parseSopChecklistRules(text));
