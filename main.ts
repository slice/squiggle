import peggy from "npm:peggy@latest";
/// <reference types="npm:@types/node" />
import { inspect } from "node:util";

const parser = peggy.generate(`
{
  let indentStack = [];
  let indent = '';
  function array(n) { return !Array.isArray(n) ? [n] : n; }
}

Program = _ exprs:(Expression |..,Separator|) _ { return { type: 'Program', exprs }; }

Expression
  = Assign
  / left:mu _sp m:[+-] _sp right:Expression { return { type: m === '+' ? 'Addition' : 'Subtraction', left, right }; }
  / mu
mu
  = left:ex _sp m:[*/] _sp right:mu { return { type: m === '*' ? 'Multiplication' : 'Division', left, right }; }
  / ex
ex
  = '(' _sp @Expression _sp ')'
  / ExpressionLow

ExpressionLow
  = FunctionLiteral
  / GappedFunctionLiteral
  / ObjectLiteral
  / String
  / Integer
  / FunctionDefinition
  / Call
  / Identifier
  / Block

Assign "assignment"
  = pattern:Pattern _sp "=" _sp value:(IndentedObjectLiteral / Expression) { return { type: 'Assignment', pattern, value }; }

Samedent = spaces:$([ \\t]*) &{ return spaces === indent; }
Dedent = &{ indent = indentStack.pop(); return true; }
Indent = spaces:$([ \\t]+) &{ return spaces.length > indent.length; } { indentStack.push(indent); indent = spaces; }

Target = PropertyTraversal / Identifier

FunctionDefinition
  = target:Target args:Arguments _sp "=" _sp value:(IndentedBlock / Expression) { return { type: 'FunctionDefinition', target, value, args }; }

IndentedBlock
  = "\\n" Indent exprs:(Expression |1..,Separator|) Dedent { return { type: 'IndentedBlock', exprs }; }
  / Block

Call "function call"
  = name:Target string:String { return { type: 'Call', name, args: [string] }; }
  / name:Target sp args:(Expression / IndentedObjectLiteral |1.., ", " _sp|) { return { type: 'Call', name, args: array(args) }; }
  / name:Target "(" _sp args:(Expression |.., "," _sp|) _sp ")" { return { type: 'Call', name, args: array(args) }; }

String "string"
  = '\\'' text:$[^']* '\\'' { return { type: 'String', text }; }

PropertyTraversal "property traversal"
  = properties:Identifier |2..,"\\\\"| { return { type: 'PropertyTraversal', properties }; }

IndentedObjectLiteral "indented object literal"
  = "\\n" Indent kvs:(KeyValue |..,Separator|) Dedent { return { type: 'IndentedObjectLiteral', kvs }; }

KeyValue "key-value pair"
  = key:Target _sp ":" _sp value:(IndentedObjectLiteral / Expression) { return [key, value]; }
  / key:Target args:Arguments _sp ":" _sp expr:(IndentedBlock / Expression) { return [key, { type: 'FunctionLiteral', args, expr}]; }

Separator "newlines or ~"
  = "\\n" Samedent _
  / ([ \\t]* "~" _)

Block "block"
  = "{" _ expressions:(Expression |.., Separator|) _ "}" { return { type: 'Block', expressions }; }

ObjectLiteral "object literal"
  = "{" _ kvs:(KeyValue |.., Separator|) _ "}" { return { type: 'ObjectLiteral', kvs }; }
ObjectDestructuring "object destructuring"
  = "{" _ keys:Identifier |.., Separator| _ "}" { return { type: 'ObjectDestructuring', keys }; }

Pattern "pattern"
  = ObjectDestructuring
  / "*" "?"? projector:Identifier _sp name:Identifier { return { type: 'Pattern', projector, name }; }
  / name:Identifier { return { type: 'Pattern', projector: null, name }; }

Arguments "arguments"
  = "(" _ args:Pattern |.., _ "," _| _ ")" { return args; }

FunctionLiteral "function literal"
  = args:Arguments? _ "->" _ expr:Expression { return { type: 'FunctionLiteral', args, expr }; }
GappedFunctionLiteral "gap function literal"
  = "#" expr:Expression { return { type: 'GappedFunctionLiteral', expr }; }

Identifier "identifier"
  = name:$([@-_a-zA-Z?!<>] [-_a-zA-Z0-9?!<>]*) { return { type: 'Identifier', name }; }

Term
  = head:Factor tail:(_ ("*" / "/") _ Factor)* {
      return tail.reduce(function(result, element) {
        if (element[1] === "*") { return result * element[3]; }
        if (element[1] === "/") { return result / element[3]; }
      }, head);
    }

Factor
  = "(" _ expr:Expression _ ")" { return expr; }
  / Integer

Integer "integer"
  = _ [0-9]+ { return { type: 'Integer', value: Number.parseInt(text(), 10) }; }

_sp "spaces"
  = [ \\t]*
sp "spaces"
  = [ \\t]+
nl "newlines"
  = [\\n\\r]+
_ "newlines or spaces"
  = [ \\t\\n\\r]*
`);

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
    const parsed = parser.parse(await Deno.readTextFile(filename));
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

for await (const event of Deno.watchFs(filename)) {
  await doit();
}
