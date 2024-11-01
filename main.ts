import peggy from "npm:peggy@latest";
import { inspect } from "node:util";

const parser = peggy.generate(`
{
  let indentStack = [];
  let indent = '';
}

Program = _ @(Expression |..,Separator|) _

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
  / Integer
  / Call
  / Identifier
  / Block

Assign "assignment"
  = pattern:Pattern _sp "=" _sp value:(IndentedObjectLiteral / Expression) { return { type: 'Assignment', pattern, value }; }

Samedent = spaces:$([ \\t]*) &{ console.log('current',indent.length, 'has',spaces.length); return spaces === indent; }
Dedent = &{ indent = indentStack.pop(); return true; }
Indent = spaces:$([ \\t]+) &{ return spaces.length > indent.length; } { indentStack.push(indent); indent = spaces; }

Call "function call"
  = name:(Identifier / PropertyTraversal) _sp args:(Expression |1..,"," _sp|) { return { type: 'Call', name, args }; }

PropertyTraversal "property traversal"
  = properties:Identifier |1..,"\\\\"| { return { type: 'PropertyTraversal', properties }; }

IndentedObjectLiteral "indented object literal"
  = "\\n" Indent kvs:(KeyValue |..,Separator|) Dedent { return { type: 'IndentedObjectLiteral', kvs }; }

KeyValue "key-value pair"
  = key:(PropertyTraversal / Identifier) _sp ":" _sp value:(IndentedObjectLiteral / Expression) { return [key, value]; }

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
  / ident:Identifier { return { type: 'Pattern', ident }; }

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
  = _ [0-9]+ { return Number.parseInt(text(), 10); }

_sp "spaces"
  = [ \\t]*
nl "newlines"
  = [\\n\\r]+
_ "newlines or spaces"
  = [ \\t\\n\\r]*
`);

console.log(
  inspect(parser.parse(`xoo = -> (2-3)/4`), {
    depth: Infinity,
    colors: true,
    compact: true,
    numericSeparator: true,
  })
);
