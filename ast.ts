export type Identifier = { type: "Identifier"; name: string };
export type Pattern = {
  type: "Pattern";
  projector: null | Identifier;
  name: Identifier;
};
export type ObjectDestructuring = {
  type: "ObjectDestructuring";
  keys: Identifier[];
};
export type PropertyTraversal = {
  type: "PropertyTraversal";
  properties: Identifier[];
};
export type KeyValue = [key: Target, value: IndentedObjectLiteral | Expression];
export type Target = PropertyTraversal | Identifier;
export type Block = { type: "Block"; exprs: Expression[] };

export type Call = {
  type: "Call";
  name: Target;
  args: Expression[] | [IndentedObjectLiteral];
};

export type Integer = { type: "Integer"; value: number };
export type String = { type: "String"; text: string };
export type Assignment = {
  type: "Assignment";
  pattern: Pattern | ObjectDestructuring;
  value: Expression | IndentedObjectLiteral;
};

export type Expression =
  | { type: "Program"; exprs: Expression[] }
  | { type: "Addition"; left: Expression; right: Expression }
  | { type: "Subtraction"; left: Expression; right: Expression }
  | { type: "Multiplication"; left: Expression; right: Expression }
  | { type: "Division"; left: Expression; right: Expression }
  | Assignment
  | {
      type: "FunctionLiteral";
      args: Pattern[];
      expr: Expression; // TODO: | IndentedBlock
    }
  | {
      type: "ObjectLiteral";
      kvs: KeyValue[];
    }
  | {
      type: "FunctionDefinition";
      target: Target;
      value: Expression | IndentedBlock;
      args: Pattern[];
    }
  | String
  | Integer
  | Call
  | Identifier
  | Block;

export type Node =
  | Expression
  | Pattern
  | IndentedObjectLiteral
  | IndentedBlock
  | PropertyTraversal
  | ObjectDestructuring;

// -- not always valid in expression position ----------------------------------

/**
 * a block implicitly formed via indentation
 *
 * such as:
 *
 *   my-function(arg) =
 *     console\log 'wow'
 *
 * also in `ObjectLiteral` (this uses an `IndentedObjectLiteral` too, because
 * there's no braces):
 *
 *   my-object =
 *     method-thats-in-the-object(arg) =
 *       console\log 'wow'
 */
export type IndentedBlock = { type: "IndentedBlock"; exprs: Expression[] };

export type IndentedObjectLiteral = {
  type: "IndentedObjectLiteral";
  kvs: KeyValue[];
};
