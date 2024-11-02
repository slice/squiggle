import * as squiggle from "./grammar/squiggle.js";
/// <reference types="npm:@types/node" />
import { inspect } from "node:util";

import * as AST from "./ast.ts";

function expand(node: AST.Node): string {
  switch (node.type) {
    case "FunctionDefinition":
      return `function ${expand(node.target)}(${node.args.map(expand).join(",")}) { return ${expand(node.value)}; }`;
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
    case "IndentedBlock": {
      let body = node.exprs
        .map((subNode, index) => {
          let expr = expand(subNode);
          if (index === node.exprs.length - 1) return `return ${expr};`;
          return `${expr};`;
        })
        .join(" ");

      return `(() => { ${body} })()`;
    }
    case "Addition":
    case "Subtraction":
    case "Multiplication":
    case "Division": {
      const infix = {
        Addition: "+",
        Subtraction: "-",
        Multiplication: "*",
        Division: "/",
      }[node.type];
      return `(${expand(node.left)} ${infix} ${expand(node.right)})`;
    }
    case "Call": {
      let args = Array.isArray(node.args)
        ? node.args.map(expand).join(",")
        : expand(node.args);
      return `${expand(node.name)}(${args})`;
    }
    case "Program":
      return node.exprs.map(expand).join(";\n");
    case "Assignment":
      return `let ${expand(node.pattern)} = ${expand(node.value)};`;
    case "Integer":
      return node.value.toString();
    case "String":
      return JSON.stringify(node.text);
    case "FunctionLiteral":
      return `function(${node.args.map(expand).join(",")}) { return ${expand(node.expr)}; }`;
    case "If":
      if (node.else) {
        return `(${expand(node.cond)} ? ${expand(node.body)} : ${expand(node.else.body)})`;
      } else {
        return `(${expand(node.cond)} ? ${expand(node.body)} : undefined)`;
      }
    default:
      throw new Error(`Unhandled AST node "${node.type}" :(`);
  }
}

let filename = "./hi.~";

async function doit() {
  console.clear();
  console.log(`[${new Date().toLocaleString()}]`);
  try {
    let parsed = squiggle.parse(await Deno.readTextFile(filename));
    console.log(
      inspect(parsed, {
        depth: Infinity,
        colors: true,
        compact: true,
        numericSeparator: true,
      })
    );

    console.log();
    let compiled = expand(parsed);
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

for await (let _ of Deno.watchFs(filename)) {
  await doit();
}
