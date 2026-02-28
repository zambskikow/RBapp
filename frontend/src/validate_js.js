try {
    require('fs').readFileSync(process.argv[2], 'utf-8');
    // Basic syntax check using Node.js vm
    require('vm').runInNewContext(require('fs').readFileSync(process.argv[2], 'utf-8'), {}, { filename: process.argv[2] });
    console.log("Syntax OK");
} catch (e) {
    console.error(e.stack);
    process.exit(1);
}
