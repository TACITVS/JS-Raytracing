// File: scripts/copy-files.js
// This script uses Node.js's built-in modules to copy files,
// which is much more reliable than third-party packages.

import fs from 'fs';
import path from 'path';

const source = 'src/shaders';
const destination = 'dist/shaders';

// Create destination directory if it doesn't exist
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}
if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination);
}

// Copy each file from the source to the destination
fs.readdirSync(source).forEach(file => {
    const sourceFile = path.join(source, file);
    const destFile = path.join(destination, file);
    fs.copyFileSync(sourceFile, destFile);
    console.log(`Copied ${sourceFile} to ${destFile}`);
});
