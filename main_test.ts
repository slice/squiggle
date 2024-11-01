import { assertEquals, assertThrows } from "@std/assert";
import * as squiggle from "./grammar/squiggle.js";
import * as AST from "./ast.ts";

function p(
  sourceCode: string | TemplateStringsArray,
  expected?: AST.Expression | AST.Expression[]
) {
  let exprs = Array.isArray(expected) ? expected : [expected];
  let resolvedCode = Array.isArray(sourceCode) ? sourceCode[0] : sourceCode;
  assertEquals(squiggle.parse(resolvedCode), { type: "Program", exprs });
}

const n = {
  Call(name: AST.Call["name"], args: AST.Call["args"] = []): AST.Call {
    return { type: "Call", name, args };
  },
  Integer(value: number): AST.Integer {
    return { type: "Integer", value };
  },
  Assignment(
    pattern: AST.Assignment["pattern"],
    value: AST.Assignment["value"]
  ): AST.Assignment {
    return { type: "Assignment", pattern, value };
  },
};

function ident(strings: TemplateStringsArray): AST.Identifier {
  return { type: "Identifier", name: strings.join("") };
}
function str(strings: TemplateStringsArray): AST.String {
  return { type: "String", text: strings.join("") };
}

Deno.test(function calls() {
  p("hello()", n.Call(ident`hello`));
  p("hello 1", n.Call(ident`hello`, [n.Integer(1)]));
  p(
    "hello 1, 2, 3",
    n.Call(ident`hello`, [n.Integer(1), n.Integer(2), n.Integer(3)])
  );
  p(`hello'yo'`, n.Call(ident`hello`, [str`yo`]));
  p(
    `hello { 1~ 2 }`,
    n.Call(ident`hello`, [
      { type: "Block", exprs: [n.Integer(1), n.Integer(2)] },
    ])
  );
  assertThrows(() => p`hello{ a: 1 }`);
  p(
    `hello { a: 1 }`,
    n.Call(ident`hello`, [
      { type: "ObjectLiteral", kvs: [[ident`a`, n.Integer(1)]] },
    ])
  );
});

Deno.test(function callsWithIndentedObjectLiterals() {
  p(
    `hello
  key: 'value'
  other: 2
  has: call 'me'`,
    n.Call(ident`hello`, [
      {
        type: "IndentedObjectLiteral",
        kvs: [
          [ident`key`, str`value`],
          [ident`other`, n.Integer(2)],
          [ident`has`, n.Call(ident`call`, [str`me`])],
        ],
      },
    ])
  );

  p(
    `one
  two: a
    b: 'value'`,
    n.Call(ident`one`, [
      {
        type: "IndentedObjectLiteral",
        kvs: [
          [
            ident`two`,
            n.Call(ident`a`, [
              { type: "IndentedObjectLiteral", kvs: [[ident`b`, str`value`]] },
            ]),
          ],
        ],
      },
    ])
  );
});

Deno.test(function assignmentWithIndentedObjectLiterals() {
  p(
    `a =
  k: 'v'
  n: 0`,
    n.Assignment(
      { type: "Pattern", projector: null, name: ident`a` },
      {
        type: "IndentedObjectLiteral",
        kvs: [
          [ident`k`, str`v`],
          [ident`n`, n.Integer(0)],
        ],
      }
    )
  );
});

const onePlusOne = {
  type: "Addition",
  left: n.Integer(1),
  right: n.Integer(1),
} as const;

Deno.test(function if_() {
  let ok = [
    {
      type: "If" as const,
      cond: onePlusOne,
      else: null,
      body: [n.Call(ident`o`, [str`k`])],
    },
    n.Integer(2),
  ];

  p(
    `if 1 + 1
  o 'k'
2`,
    ok
  );

  p(
    `if 1 + 1~ o 'k'
2`,
    ok
  );
});

Deno.test(function else_() {
  let ok = [
    {
      type: "If" as const,
      cond: onePlusOne,
      else: { type: "Else", body: n.Integer(5) } as const,
      body: [n.Call(ident`o`, [])],
    },
    n.Integer(3),
  ];

  p(
    `if 1 + 1~ o() else 5
3`,
    ok
  );

  p(
    `if 1 + 1
  o()
else
  5
3`,
    ok
  );
});
