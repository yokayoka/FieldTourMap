/**
 * RFC 4180準拠の小さなCSVパーサー（Requirement 16）。Googleスプレッドシート
 * の「ウェブに公開」CSVエンドポイントをfetchした結果をパースするために使う。
 * 引用符で囲まれたフィールド内のカンマ・改行・二重引用符（""でエスケープ）
 * を扱う。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  function pushField(): void {
    row.push(field);
    field = "";
  }

  function pushRow(): void {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }

  // 末尾に改行がある場合はループ内で既に確定済みのため、余剰の空行として
  // 追加しない。改行なしで終わる最後の行のみここで確定する。
  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}
