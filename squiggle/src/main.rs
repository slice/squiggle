#![allow(dead_code)]
use chumsky::prelude::*;

#[derive(Debug)]
enum Expr {
    Ident(String),

    Num(f64),
    Neg(Box<Expr>),
    Add(Box<Expr>, Box<Expr>),
    Sub(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
    Div(Box<Expr>, Box<Expr>),

    Call(String, Vec<Expr>),
    Let {
        name: String,
        rhs: Box<Expr>,
        then: Box<Expr>,
    },
    Fn {
        name: String,
        args: Vec<String>,
        body: Box<Expr>,
        then: Box<Expr>,
    },
    Assign {
        name: String,
        value: Box<Expr>,
    },
    Block(Vec<Expr>),
    KeyValue {
        key: String,
        value: Box<Expr>,
    },
    ObjectLiteral {
        key_values: Vec<Expr>,
    },
}

fn parser() -> impl Parser<char, Vec<Expr>, Error = Simple<char>> {
    let sep = just('~')
        .padded()
        .ignored()
        .or(text::whitespace().ignored());

    recursive(|expr| {
        let int = text::int(10)
            .map(|s: String| Expr::Num(s.parse().unwrap()))
            .padded();

        let ident = filter(|&c: &char| c == '-' || c == '_' || c.is_alphanumeric())
            .repeated()
            .at_least(1)
            .collect::<String>();

        let key_value = ident
            .then_ignore(just(':').padded())
            .then(expr.clone())
            .map(|(key, value)| Expr::KeyValue {
                key,
                value: Box::new(value),
            });

        let block = expr
            .clone()
            .separated_by(sep)
            .allow_trailing()
            .delimited_by(just('{'), just('}'))
            .padded()
            .map(Expr::Block);

        let object_literal = (key_value.padded().repeated().at_least(1))
            .delimited_by(just('{'), just('}'))
            .padded()
            .collect::<Vec<_>>()
            .map(|key_values| Expr::ObjectLiteral { key_values });

        let assignment = ident
            .then_ignore(just('=').padded())
            .then(expr.clone())
            .map(|(name, value)| Expr::Assign {
                name,
                value: Box::new(value),
            });

        let atom = int.or(expr.delimited_by(just('('), just(')'))).padded();

        let op = |c| just(c).padded();

        let unary = op('-')
            .repeated()
            .then(atom)
            .foldr(|_op, rhs| Expr::Neg(Box::new(rhs)));

        let product = unary
            .clone()
            .then(
                op('*')
                    .to(Expr::Mul as fn(_, _) -> _)
                    .or(op('/').to(Expr::Div as fn(_, _) -> _))
                    .then(unary)
                    .repeated(),
            )
            .foldl(|lhs, (op, rhs)| op(Box::new(lhs), Box::new(rhs)));

        let sum = product
            .clone()
            .then(
                op('+')
                    .to(Expr::Add as fn(_, _) -> _)
                    .or(op('-').to(Expr::Sub as fn(_, _) -> _))
                    .then(product)
                    .repeated(),
            )
            .foldl(|lhs, (op, rhs)| op(Box::new(lhs), Box::new(rhs)));

        choice((
            assignment,
            block,
            object_literal,
            sum,
            ident.map(Expr::Ident as fn(_) -> _),
        ))
        .padded()
    })
    .separated_by(sep)
    .allow_trailing()
    .then_ignore(end())
}

// this is horrid
fn sprinkle_blocks(text: &str) -> String {
    let lines = text.lines().collect::<Vec<_>>();
    let mut buffer = String::new();
    let mut level: i32 = 0;

    for (index, line) in lines.iter().enumerate() {
        // look at next line to see indent change
        let Some(next_line) = lines.iter().nth(index + 1) else {
            buffer.push_str(&format!("{line}\n"));
            break;
        };
        let n_spaces = next_line
            .find(|c: char| !c.is_whitespace())
            .unwrap_or_default() as i32;

        let old_level = level;
        let new_level = n_spaces / 2;
        level = new_level as i32;

        buffer.push_str(&format!("{line}"));
        let delta = new_level - old_level;
        if delta == 1 {
            // indent increasing, add { on the next line
            buffer.push_str(&format!(" {{\n"));
        } else if delta == -1 {
            // decreasing, add } _after_ the next line
            let spaces = "  ".repeat(new_level as usize);
            buffer.push_str(&format!("\n{spaces}}}\n"));
        } else {
            buffer.push('\n');
        }
    }

    while level > 0 {
        level -= 1;
        let spaces = "  ".repeat(level as usize);
        buffer.push_str(&format!("{spaces}}}"));
    }

    buffer
}

fn main() {
    let src = std::fs::read_to_string(std::env::args().nth(1).unwrap()).unwrap();
    let modified_src = sprinkle_blocks(&src);
    eprintln!("{}", modified_src);
    println!("{:?}", parser().parse(modified_src));
}
