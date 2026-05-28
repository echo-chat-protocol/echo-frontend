// This file implements the tree math for the binary tree structure used in the MLS protocol. 
// Todo lo que sea relacionado con TreeKEM 

// Keeping in mind that the tree is represented as an array where n = leaves and number_node = 2n - 1

// Calculates the level of a node in the tree given its index
export function level(x) {
    if((x & 1) === 0) return 0;
    let k = 0;
    while(((x >> k) & 1) === 1)k++;
    return k;
}

// Calculates the total number of nodes in a tree given the number of leaves
export function nodeWidth(n){
    if (n === 0) return 0;
    return 2*n -1;
}

// Calculates the index of the root node given the number of leaves
export function root(n){
    const w = 2 * n - 1;
    return (1 << Math.floor(Math.log2(w))) - 1;
}

// Calculates the index of the left child of a node
export function left(x){
    const k = level(x);
    if (k === 0) throw new RangeError("Leaves have no children");
    return x ^ (1 << (k - 1));
}

// Calculates the index of the right child of a node
export function right(x){
    const k = level(x);
    if (k === 0) throw new RangeError("Leaves have no children");
    return x ^ (3 << (k - 1));
}

// Helper function for parent, calculates the parent index without checking if it's out of bounds
function parentStep(x){
    const k = level(x);
    const b = (x >> (k + 1)) & 1;
    return (x | (1 << k)) ^ (b << (k + 1));
}

// Calculates the index of the parent of a node given the number of leaves
export function parent(x, n){
    if (x === root(n)) return x;
    let p = parentStep(x);
    while(p >= nodeWidth(n)) p = parentStep(p);
    return p;
}

// Calculates the index of the sibling of a node given the number of leaves
export function sibling(x, n){
    const p = parent(x, n);
    if (p === x) return x;
    return x < p ? right(p): left(p);
}


// Calculate the direct path from a leaf to the root, excluding the leaf and including the root
export function directPath(x, n){
    const r = root(n);
    if (x === r) return [];
    const path = [];
    let current = parent(x, n);
    while(true){
        path.push(current);
        if (current === r) break;
        current = parent(current, n);
    }
    return path;
}

// Calculate the copath of a leaf, which is the list of siblings of the nodes in the direct path
export function copath(x, n){
    const fullPath = [x, ...directPath(x, n)];
    return fullPath.slice(0, -1).map(node => sibling(node, n));
}

// A blank node is a node that does not have a public key, in the tree representation this is represented
// by the node being undefined or having publicKeyB64 being undefined

// This function resolves the tree to find the non-blank nodes in the tree, given a list
// of nodes and a node index It returns the list of non-blank nodes in the subtree rooted 
// at the given node index
export function resolution(nodes, x, n){
    const w = nodeWidth(n);

    // Virtual Node
    if(x >= w) {
        if (level(x) === 0) return [];
        return[
            ...resolution(nodes, left(x), n),
            ...resolution(nodes, right(x), n),
        ];
    }

    // Non-Blank real node
    if (nodes[x]?.publicKeyB64) return [x];

    // Blank real leaf
    if(level(x) === 0) return [];

    // Blank real internal node
    return [
        ...resolution(nodes, left(x), n),
        ...resolution(nodes, right(x), n),
    ];
}


// This function calculates the parent node index of a blank node, given the index of the blank node and the number of leaves
export function leafNode(k){
    return 2 * k;
}