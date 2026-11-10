function appendRich(node, line, blanks, checks) {
  const parts = String(line).split(/(\[ \]|____)/);
  for (const part of parts) {
    if (part === '____') {
      const field = document.createElement('input');
      field.className = 'short';
      field.autocomplete = 'off';
      blanks.push(field);
      node.append(field);
    } else if (part === '[ ]') {
      const field = document.createElement('input');
      field.type = 'checkbox';
      checks.push(field);
      node.append(field);
    } else if (part) node.append(document.createTextNode(part));
  }
}

function tableFrom(rows) {
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const body = document.createElement('tbody');
  let header = null;
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (!cells.length || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (!header) {
      header = cells;
      const tr = document.createElement('tr');
      for (const cell of cells) {
        const th = document.createElement('th');
        th.textContent = cell;
        tr.append(th);
      }
      head.append(tr);
    } else {
      const tr = document.createElement('tr');
      for (const cell of cells) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.append(td);
      }
      body.append(tr);
    }
  }
  table.append(head, body);
  return table;
}

export function renderProtocol(text) {
  const host = document.createElement('div');
  host.className = 'covenant-text';
  const blanks = [];
  const checks = [];
  const lines = String(text || '').replace(/\n$/, '').split('\n');
  let index = 0;
  while (index < lines.length) {
    if (lines[index].startsWith('|')) {
      const rows = [];
      while (index < lines.length && lines[index].startsWith('|')) rows.push(lines[index++]);
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      wrap.append(tableFrom(rows));
      host.append(wrap);
      continue;
    }
    const line = document.createElement('div');
    appendRich(line, lines[index], blanks, checks);
    host.append(line);
    index += 1;
  }
  return { host, blanks, checks };
}
