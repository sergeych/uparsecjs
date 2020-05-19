#!/usr/bin/env node

const argv = process.argv.slice(2);
if( argv.length < 1 ) {
  console.log(`
Usage:

uencrypt <file-to-encrypt>
   
  `);
}
else {
  (async () => {
    const outName = argv[0] + ".uencrypted";
    const fs = require('fs').promises;
    const plain = await fs.readFile(argv[0]);
    console.log("Please input password:")
    // console.log("I've read:", plain);
  })().catch((e) => {
    console.error("Failed to encrypt: "+e);
  });
}
