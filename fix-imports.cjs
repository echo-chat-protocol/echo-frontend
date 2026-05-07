const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// 1. Build a map of all files in src/
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
            
            // Allow lookup by basename or basename without extension
            if (!fileMap.has(basename)) fileMap.set(basename, []);
            fileMap.get(basename).push(fullPath);
            
            if (!fileMap.has(basenameNoExt)) fileMap.set(basenameNoExt, []);
            fileMap.get(basenameNoExt).push(fullPath);
        }
    }
}
walk(srcDir);

// 2. Helper to get an alias for a full path
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
    // Already aliased or node module
    if (importPath.startsWith('@') || !importPath.startsWith('.')) return null;

    let absPath = path.resolve(currentDir, importPath);
    let resolved = null;

    // Check if it's currently valid (file or dir with index)
    if (fs.existsSync(absPath)) {
        if (fs.statSync(absPath).isDirectory()) {
             if (fs.existsSync(path.join(absPath, 'index.js'))) resolved = path.join(absPath, 'index.js');
             else if (fs.existsSync(path.join(absPath, 'index.jsx'))) resolved = path.join(absPath, 'index.jsx');
        } else {
            resolved = absPath;
        }
    } else {
        if (fs.existsSync(absPath + '.js')) resolved = absPath + '.js';
        else if (fs.existsSync(absPath + '.jsx')) resolved = absPath + '.jsx';
    }

    if (resolved) {
        return null; // It's valid relative import, leave it alone!
    }

    // It's broken. Try to find it by basename.
    const importBasename = path.basename(importPath);
    const candidates = fileMap.get(importBasename) || [];

    if (candidates.length === 1) {
        let alias = getAliasForPath(candidates[0]);
        // Remove extension for js/jsx
        if (alias.endsWith('.js') || alias.endsWith('.jsx')) {
            alias = alias.replace(/\.[^/.]+$/, "");
        }
        return alias;
    } else if (candidates.length > 1) {
        // Tie breaker: try to find a candidate that matches more of the path
        const importParts = importPath.split(/[/\\]/);
        const bestCandidates = candidates.filter(c => {
             const cParts = c.split(/[/\\]/);
             // See if the parent dir matches
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
            if (alias.endsWith('.js') || alias.endsWith('.jsx')) {
                alias = alias.replace(/\.[^/.]+$/, "");
            }
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

    // Regex to match imports: import ... from '...'; import '...'; export ... from '...'
    const importRegex = /(import(?:[\s\S]*?from)?\s+['"])(.*?)(['"])|(export(?:[\s\S]*?from)?\s+['"])(.*?)(['"])/g;
    
    let modified = false;
    content = content.replace(importRegex, (match, p1, p2, p3, p4, p5, p6) => {
        const prefix = p1 || p4;
        const importPath = p2 || p5;
        const suffix = p3 || p6;

        const newImport = resolveImport(importPath, dir);
        if (newImport) {
            console.log(`[FIX] ${importPath}  ->  ${newImport}  in ${path.relative(srcDir, filePath)}`);
            modified = true;
            return prefix + newImport + suffix;
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
console.log("Import fixing pass completed.");
