{
  let indentStack = [];
  let indent = '';
  function array(n) { return !Array.isArray(n) ? [n] : n; }
}

Program = _ exprs:(Expression |..,Separator|) _ { return { type: 'Program', exprs }; }

Expression
  = Assignment
  / left:Multiplicative _sp m:[+-] _sp right:Expression { return { type: m === '+' ? 'Addition' : 'Subtraction', left, right }; }
  / Multiplicative
Multiplicative
  = left:ex _sp m:[*/] _sp right:Multiplicative { return { type: m === '*' ? 'Multiplication' : 'Division', left, right }; }
  / ex
ex
  = Block
  / ExpressionLow

ExpressionLow
  = FunctionLiteral
  / GappedFunctionLiteral
  / ObjectLiteral
  / String
  / Integer
  / FunctionDefinition
  / If
  / Call
  // TODO: this should be `Target`. also how is being able to refer to a value
  // without doing anything else helpful? maybe it can be a call instead?
  / Identifier

Assignment "assignment"
  = pattern:Pattern _sp "=" _sp value:(IndentedObjectLiteral / Expression) { return { type: 'Assignment', pattern, value }; }

Samedent = spaces:$([ \t]*) &{ return spaces === indent; }
Dedent = &{ indent = indentStack.pop(); return true; }
Indent = spaces:$([ \t]+) &{ return spaces.length > indent.length; } { indentStack.push(indent); indent = spaces; }

Else
  = "else" _sp body:(Expression / IndentedBlock) { return { type: 'Else', body }; }

If
  // multiline
  = "if" sp cond:Expression nl Indent body:(Expression |1..,nl Samedent _|) Dedent els:(nl @Else)? { return { type: 'If', cond, body: { type: 'IndentedBlock', exprs: body }, else: els ?? null }; }
  / "if" sp cond:Expression Collapser body:Expression els:(_ @Else)? { return { type: 'If', cond, body: body, else: els ?? null } }

Target = PropertyTraversal / Identifier

FunctionDefinition
  = target:Target args:Arguments _sp "=" _sp value:(IndentedBlock / Expression) { return { type: 'FunctionDefinition', target, value, args }; }

IndentedBlock
  = nl Indent exprs:(Expression |1..,Separator|) Dedent { return { type: 'IndentedBlock', exprs }; }
  / Block

Call "function call"
  = name:Target string:String { return { type: 'Call', name, args: [string] }; }
  / name:Target lit:IndentedObjectLiteral { return { type: 'Call', name, args: [lit] }; }
  / name:Target sp args:(Expression |1.., ", " _sp|) { return { type: 'Call', name, args: array(args) }; }
  / name:Target "(" _sp args:(Expression |.., "," _sp|) _sp ")" { return { type: 'Call', name, args: array(args) }; }

String "string"
  = '\'' text:$[^']* '\'' { return { type: 'String', text }; }

PropertyTraversal "property traversal"
  = properties:Identifier |2..,"\\"| { return { type: 'PropertyTraversal', properties }; }

IndentedObjectLiteral "indented object literal"
  = "\n" Indent kvs:(KeyValue |..,Separator|) Dedent { return { type: 'IndentedObjectLiteral', kvs }; }

KeyValue "key-value pair"
  = key:Target _sp ":" _sp value:(IndentedObjectLiteral / Expression) { return [key, value]; }
  / key:Target args:Arguments _sp ":" _sp expr:(IndentedBlock / Expression) { return [key, { type: 'FunctionLiteral', args, expr}]; }

Collapser = ([ \t]* "~" _)

Separator "newlines or ~"
  = "\n" Samedent _
  / Collapser

Block "block"
  = "{" _ exprs:(Expression |.., Separator|) _ "}" { return { type: 'Block', exprs }; }

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

Integer "integer"
  = _ [0-9]+ { return { type: 'Integer', value: Number.parseInt(text(), 10) }; }

_sp "spaces"
  = [ \t]*
sp "spaces"
  = [ \t]+
nl "newlines"
  = [\n\r]+
_ "newlines or spaces"
  = [ \t\n\r]*
