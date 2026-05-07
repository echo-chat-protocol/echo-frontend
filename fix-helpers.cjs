const fs = require('fs');
const path = require('path');

const libCryptoDir = path.join(__dirname, 'src/lib/crypto');

function walkProcess(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkProcess(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            let newContent = content.replace(/['"]\.\.\/helpers(\.js)?['"]/g, "'@features/chat/utils/helpers'");
            newContent = newContent.replace(/['"]\.\.\/\.\.\/helpers(\.js)?['"]/g, "'@features/chat/utils/helpers'");
            
            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log('Fixed helpers import in', fullPath);
            }
        }
    }
}

walkProcess(libCryptoDir);
