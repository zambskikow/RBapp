const fs = require('fs');
const path = 'js/app.js';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/class="badge \${log\.permissao ===/g, 'class="table-badge ${log.permissao ===');
fs.writeFileSync(path, c, 'utf8');
