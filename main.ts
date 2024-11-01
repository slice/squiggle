import * as squiggle from "./grammar/squiggle.js";
/// <reference types="npm:@types/node" />
import { inspect } from "node:util";

function exp(n) {
  switch (n.type) {
    case "FunctionDefinition":
      return `function ${n.target.name}(${n.args.map(exp).join(",")}) { return ${exp(n.value)}; }`;
    case "Pattern":
      return exp(n.name);
    case "Identifier":
      return n.name.replace(/-([a-zA-Z])/g, (_, m) => m.toUpperCase());
    case "IndentedObjectLiteral":
    case "ObjectLiteral":
      return `{ ${n.kvs.map(([key, value]) => `${exp(key)}: ${exp(value)}`)} }`;
    case "PropertyTraversal":
      return `(${n.properties.map(exp).join(".")})`;
    case "Block":
    case "IndentedBlock":
      return `(() => { ${n.exprs.map((sn, i) => (i === n.exprs.length - 1 ? "return " : "") + exp(sn)).join("\n")} })()`;
    case "Addition":
      return `(${exp(n.left)} + ${exp(n.right)})`;
    case "Call":
      return `${exp(n.name)}(${n.args.map(exp).join(",")})`;
    case "Program":
      return n.exprs.map(exp).join(";\n");
    case "Assignment":
      return `let ${exp(n.pattern)} = ${exp(n.value)};`;
    case "Integer":
      return n.value;
    case "String":
      return JSON.stringify(n.text);
    case "FunctionLiteral":
      return `function(${n.args.map(exp).join(",")}) { return ${exp(n.expr)}; }`;
    default:
      throw new Error(`Unhandled AST node "${n.type}" :(`);
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
    const compiled = exp(parsed);
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
