const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const fileMap = new Map();

function walk(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.css') || fullPath.endsWith('.svg') || fullPath.endsWith('.png')) {
            const basename = path.basename(fullPath);
            const basenameNoExt = basename.replace(/\.[^/.]+$/, "");
            if (!fileMap.has(basename)) fileMap.set(basename, []);
            fileMap.get(basename).push(fullPath);
            if (!fileMap.has(basenameNoExt)) fileMap.set(basenameNoExt, []);
            fileMap.get(basenameNoExt).push(fullPath);
        }
    }
}
walk(srcDir);

function getAliasForPath(fullPath) {
    const rel = path.relative(srcDir, fullPath).replace(/\\/g, '/');
    if (rel.startsWith('components/')) return '@components/' + rel.substring('components/'.length);
    if (rel.startsWith('features/')) return '@features/' + rel.substring('features/'.length);
    if (rel.startsWith('pages/')) return '@pages/' + rel.substring('pages/'.length);
    if (rel.startsWith('hooks/')) return '@hooks/' + rel.substring('hooks/'.length);
    if (rel.startsWith('services/')) return '@services/' + rel.substring('services/'.length);
    if (rel.startsWith('store/')) return '@store/' + rel.substring('store/'.length);
    if (rel.startsWith('utils/')) return '@utils/' + rel.substring('utils/'.length);
    if (rel.startsWith('lib/')) return '@lib/' + rel.substring('lib/'.length);
    if (rel.startsWith('assets/')) return '@assets/' + rel.substring('assets/'.length);
    return '@/' + rel;
}

function resolveImport(importPath, currentDir) {
    if (importPath.startsWith('@') || !importPath.startsWith('.')) return null;

    let absPath = path.resolve(currentDir, importPath);
    if (fs.existsSync(absPath)) return null;
    if (fs.existsSync(absPath + '.js')) return null;
    if (fs.existsSync(absPath + '.jsx')) return null;

    const importBasename = path.basename(importPath);
    const candidates = fileMap.get(importBasename) || [];

    if (candidates.length === 1) {
        let alias = getAliasForPath(candidates[0]);
        if (alias.endsWith('.js') || alias.endsWith('.jsx')) alias = alias.replace(/\.[^/.]+$/, "");
        return alias;
    } else if (candidates.length > 1) {
        const importParts = importPath.split(/[/\\]/);
        const bestCandidates = candidates.filter(c => {
             const cParts = c.split(/[/\\]/);
             if (importParts.length >= 2) {
                 const parent = importParts[importParts.length - 2];
                 if (parent !== '.' && parent !== '..') {
                     return cParts[cParts.length - 2] === parent;
                 }
             }
             return true;
        });

        if (bestCandidates.length === 1) {
            let alias = getAliasForPath(bestCandidates[0]);
            if (alias.endsWith('.js') || alias.endsWith('.jsx')) alias = alias.replace(/\.[^/.]+$/, "");
            return alias;
        }
    }
    return null;
}

function processFile(filePath) {
    const ext = path.extname(filePath);
    if (ext !== '.js' && ext !== '.jsx') return;

    let content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);

    // Matches import('./something')
    const dynamicRegex = /(import\s*\(\s*['"])(.*?)(['"]\s*\))/g;
    
    let modified = false;
    content = content.replace(dynamicRegex, (match, p1, importPath, p3) => {
        const newImport = resolveImport(importPath, dir);
        if (newImport) {
            console.log(`[FIX DYNAMIC] ${importPath}  ->  ${newImport}  in ${path.relative(srcDir, filePath)}`);
            modified = true;
            return p1 + newImport + p3;
        }
        return match;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function walkProcess(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkProcess(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

walkProcess(srcDir);
console.log("Dynamic import fixing pass completed.");
