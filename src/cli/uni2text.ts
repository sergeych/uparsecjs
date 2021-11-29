#!/usr/bin/env node
// noinspection ExceptionCaughtLocallyJS

// const process = require('process');

import { ArgumentParser } from 'argparse';
import * as path from "path";
import { guessUniversaObjectType, UniversaTextObjectFormatter, UniversaTextObjectParser, EmbeddedTextObject } from "../text_tools";
import { bytesToUtf8 } from "../tools";

const fs = require('fs').promises;

(async function () {
  try {
    const parser = new ArgumentParser({
      version: '0.0.1',
      addHelp: true,
      description: `
        uni2text utility converts some Universa binary objects to text and back. When packing binary objects
        to text files, it process a single file. When unpacking from text file, it extracts all object found in it.
        Conflicting file names are resolved by adding _(count) tp its name. note that if neither -t nor -b flag is 
        specified, the conversion direction will be selected by analysing source file type.`
    });

    parser.addArgument('source', {
      help: 'source file, could be binary or text file. required.'
    });

    parser.addArgument('dest', {
      help: 'destination file, optional, will be extracted from the contents or derived from the source name depending on the operation',
      nargs: '?',
      required: false
    })

    parser.addArgument(['-b', '--binary'], {
      action: 'storeTrue',
      help: 'explicitly extract binary from source text.'
    })

    parser.addArgument(['-t', '--text'], {
      action: 'storeTrue',
      help: "explicitly convert binary source file to the embedded text object."
    });

    parser.addArgument("--type", {
      help: "when converting binary object to text for unknown file type, override type field. If omitted, the type will be guessed by contents.",
      defaultValue: null
    });

    parser.addArgument("--fileName", {
      help: "when converting binary to text, overrides fileName field."
    })

    const args = parser.parseArgs();
    // console.log(args)

    const source = new Uint8Array(await fs.readFile(args.source));

    if (args.binary && args.text)
      throw "select either binary or text conversion, not both.";

    let objects: EmbeddedTextObject[] | null = null;

    if (!args.binary && !args.text) {
      // guess from file name
      switch (path.extname(args.source)) {
        case '.unicon':
        case '.unikey':
          console.log("source file type is derived from file name as BINARY");
          if (args.type)
            throw "can't override type of the universa object";
          args.type = await guessUniversaObjectType(source);
          console.log("detected object type: " + args.type);
          args.text = true;
          break;
        case '.md':
        case '.txt':
          console.log("source file type is derived from file name as TEXT");
          args.binary = true;
          break;
        default:
          console.log("source file extension is not known, examining contents");
          objects = await new UniversaTextObjectParser(bytesToUtf8(source)).objects;
          if (objects.length > 0) {
            console.log("embed text object entries found, source considered to be TEXT");
            args.binary = true;
          } else {
            console.log("source file considered to be BINARY");
            args.text = true;
            if (!args.type) {
              args.type = await guessUniversaObjectType(source);
              console.log("detected object type: " + args.type);
            }
          }
      }
    }
    // when specifying explicitly -t the type might need to be guessed
    if( !args.type ) args.type = await guessUniversaObjectType(source);

    if (!args.dest && args.text) {
      args.dest = path.basename(args.source) + ".txt";
    }
    if (args.text) {
      const outName = await getFreeFileName(args.dest);
      await fs.writeFile(outName, await UniversaTextObjectFormatter.format({
        fileName: args.fileName ?? path.basename(args.source),
        packed: source,
        type: args.type
      }));
      console.log("Exported text file: "+outName);
    }
    else {
      if( args.fileName )
        throw "can't override fileName while processing TEXT file (this is only valid when packing binary to text)";
      if( !objects ) objects = await new UniversaTextObjectParser(bytesToUtf8(source)).objects;
      if( objects.length == 0 ) throw `no embedded text objects found in ${args.source}`
      for( const eo of objects) {
        if( eo.errors.length > 0) {
          console.error(`Bad embedded object found in lines ${eo.firstLine}-${eo.lastLine}: ${eo.errors.join(", ")}`);
        }
        else {
          const obj = eo.packedObject!;
          let outName: string | undefined;
          if( obj.fileName ) {
            outName = await getFreeFileName(obj.fileName)
          }
          else {
            outName = defaultNameFor(obj.type);
          }
          await fs.writeFile(outName, obj.packed);
          console.log(`Extracted ${obj.type} to ${outName}`);
        }
      }
    }
  } catch (e) {
    console.error("\nError: " + e);
    console.error('\ntry "uni2text -h" for help\n');
  }
})();

async function fileExists(name: string): Promise<boolean> {
  try {
    await fs.lstat(name);
    return true;
  }
  catch(e) {
  }
  return false;
}

async function getFreeFileName(fileName: string): Promise<string> {
  let counter = 1;
  while(counter < 10000){
    if( !(await fileExists(fileName)) ) return fileName;
    const fullName = path.basename(fileName);
    const pos = fullName.indexOf(".");
    let [name, ext] = pos < 0 ? [fullName, ""] : [fileName.slice(0, pos), fileName.slice(pos)];
    name = name.replace(/_\d+/, '') + `_${counter++}`;
    fileName = fileName.replace(fullName, name+ext);
  }
  throw "can't create output file name";
}

function defaultNameFor(type: string): string {
  switch(type) {
    case 'public key': return "unpacked.public.unikey";
    case 'unencrypted private key': return "unpacked.private.unikey";
    case 'encrypted private key': return "unpacked_encrypted.private.unikey";
    case 'contract': return "unpacked.unicon";
    default:
      return "unpacked.bin";
  }
}

// console.log("hello122");
// console.log(process.argv);
