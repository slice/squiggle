import * as squiggle from "./grammar/squiggle.js";
/// <reference types="npm:@types/node" />
import { inspect } from "node:util";

import * as AST from "./ast.ts";

function expand(node: AST.Node): string {
  switch (node.type) {
    case "FunctionDefinition":
      return `function ${node.target.name}(${node.args.map(expand).join(",")}) { return ${expand(node.value)}; }`;
    case "Pattern":
      return expand(node.name);
    case "Identifier":
      return node.name.replace(/-([a-zA-Z])/g, (_, m) => m.toUpperCase());
    case "IndentedObjectLiteral":
    case "ObjectLiteral":
      return `{ ${node.kvs.map(([key, value]) => `${expand(key)}: ${expand(value)}`)} }`;
    case "PropertyTraversal":
      return `(${node.properties.map(expand).join(".")})`;
    case "Block":
    case "IndentedBlock":
      return `(() => { ${node.exprs.map((sn, i) => (i === node.exprs.length - 1 ? "return " : "") + expand(sn)).join("\n")} })()`;
    case "Addition":
      return `(${expand(node.left)} + ${expand(node.right)})`;
    case "Call":
      return `${expand(node.name)}(${node.args.map(expand).join(",")})`;
    case "Program":
      return node.exprs.map(expand).join(";\n");
    case "Assignment":
      return `let ${expand(node.pattern)} = ${expand(node.value)};`;
    case "Integer":
      return node.value;
    case "String":
      return JSON.stringify(node.text);
    case "FunctionLiteral":
      return `function(${node.args.map(expand).join(",")}) { return ${expand(node.expr)}; }`;
    default:
      throw new Error(`Unhandled AST node "${node.type}" :(`);
  }
}

const filename = "./hi.~";

async function doit() {
  console.clear();
  console.log(`[${new Date().toLocaleString()}]`);
  try {
    const parsed = squiggle.parse(await Deno.readTextFile(filename));
    console.log(
      inspect(parsed, {
        depth: Infinity,
        colors: true,
        compact: true,
        numericSeparator: true,
      })
    );

    console.log();
    const compiled = expand(parsed);
    console.log("Compiled:", compiled);
    console.log();
    console.log("-".repeat(50));
    console.log();

    (0, eval)(compiled);
  } catch (err) {
    console.error("Failed to parse/evaluate:", err);
  }
}

await doit();

for await (const _ of Deno.watchFs(filename)) {
  await doit();
}
