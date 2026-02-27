const fs = require('fs');

function exposeGlobals(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let functions = [];

    // match top-level function declarations
    // regex to find `function foo` or `async function foo` at the start of a line
    const regex = /^(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
        functions.push(match[1]);
    }

    // append window attachments
    if (functions.length > 0) {
        let append = '\n\n// --- Auto-Expose Globals para Vite ---\n';
        functions.forEach(f => {
            append += `if (typeof window !== "undefined") window.${f} = ${f};\n`;
        });
        fs.appendFileSync(filePath, append);
        console.log(`Exposed ${functions.length} functions in ${filePath}`);
    } else {
        console.log(`No functions found in ${filePath}`);
    }
}

exposeGlobals('src/app.js');
