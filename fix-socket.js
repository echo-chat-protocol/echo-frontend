const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkProcess(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkProcess(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            // Replace any string like "../socket" or "../../../socket"
            content = content.replace(/['"]((\.\.\/)+)socket['"]/g, "'@/socket'");
            content = content.replace(/['"](\.\/)?socket['"]/g, "'@/socket'");
            
            if (content !== fs.readFileSync(fullPath, 'utf8')) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed socket import in', fullPath);
            }
        }
    }
}

walkProcess(srcDir);
