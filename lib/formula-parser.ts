/**
 * Safe, High-Performance Telemetry Formula Compiler (Multi-Variable Edition)
 * Implements the Shunting-Yard algorithm to compile infix expressions into Postfix (RPN).
 * Evaluates raw mathematical formulas at high-frequency (10Hz+) with zero UI overhead.
 * Supports arbitrary math expressions combining multiple telemetry keys.
 * Strictly avoids unsafe eval().
 */

type TokenType = "NUMBER" | "VARIABLE" | "OPERATOR" | "LPAREN" | "RPAREN";

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS: Record<string, { precedence: number; assoc: "L" | "R" }> = {
  "+": { precedence: 2, assoc: "L" },
  "-": { precedence: 2, assoc: "L" },
  "*": { precedence: 3, assoc: "L" },
  "/": { precedence: 3, assoc: "L" }
};

// Allowed live telemetry variable names for the parser
const ALLOWED_VARS = [
  "speed",
  "rpm",
  "throttle",
  "suspension",
  "invertertemp",
  "motortemp",
  "voltage",
  "lambda",
  "satellites",
  "raw" // legacy/default raw channel
];

/**
 * Tokenizes a raw infix formula string.
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  expr = expr.replace(/\s+/g, ""); // strip all whitespace

  while (i < expr.length) {
    const char = expr[i];

    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
    } else if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
    } else if (char in OPERATORS) {
      // Support unary negative values (e.g. negative numbers or "-rpm")
      if (char === "-" && (tokens.length === 0 || tokens[tokens.length - 1].type === "OPERATOR" || tokens[tokens.length - 1].type === "LPAREN")) {
        // Read the number following the negative sign
        let numStr = "-";
        i++;
        while (i < expr.length && (/[0-9.]/).test(expr[i])) {
          numStr += expr[i];
          i++;
        }
        if (numStr === "-") {
          // If just a lone negative sign before a variable, treat it as "-1 * variable"
          tokens.push({ type: "NUMBER", value: "-1" });
          tokens.push({ type: "OPERATOR", value: "*" });
        } else {
          tokens.push({ type: "NUMBER", value: numStr });
        }
      } else {
        tokens.push({ type: "OPERATOR", value: char });
        i++;
      }
    } else if (/[0-9.]/.test(char)) {
      let numStr = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr });
    } else if (/[a-zA-Z]/.test(char)) {
      let varStr = "";
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) {
        varStr += expr[i];
        i++;
      }
      const lowerVar = varStr.toLowerCase();
      if (ALLOWED_VARS.includes(lowerVar)) {
        tokens.push({ type: "VARIABLE", value: lowerVar });
      } else {
        throw new Error(
          `Unsupported variable: "${varStr}". Use keys like: speed, rpm, throttle, suspension, inverterTemp, motorTemp, voltage, lambda, satellites.`
        );
      }
    } else {
      throw new Error(`Unexpected character: "${char}"`);
    }
  }

  return tokens;
}

/**
 * Compiles infix tokens into postfix (RPN) using the Shunting-Yard algorithm.
 */
function shuntingYard(tokens: Token[]): Token[] {
  const outputQueue: Token[] = [];
  const operatorStack: Token[] = [];

  for (const token of tokens) {
    if (token.type === "NUMBER" || token.type === "VARIABLE") {
      outputQueue.push(token);
    } else if (token.type === "OPERATOR") {
      const o1 = token.value;
      let topOp = operatorStack[operatorStack.length - 1];

      while (
        topOp &&
        topOp.type === "OPERATOR" &&
        ((OPERATORS[o1].assoc === "L" && OPERATORS[o1].precedence <= OPERATORS[topOp.value].precedence) ||
          (OPERATORS[o1].assoc === "R" && OPERATORS[o1].precedence < OPERATORS[topOp.value].precedence))
      ) {
        outputQueue.push(operatorStack.pop()!);
        topOp = operatorStack[operatorStack.length - 1];
      }
      operatorStack.push(token);
    } else if (token.type === "LPAREN") {
      operatorStack.push(token);
    } else if (token.type === "RPAREN") {
      let topOp = operatorStack[operatorStack.length - 1];
      while (topOp && topOp.type !== "LPAREN") {
        outputQueue.push(operatorStack.pop()!);
        topOp = operatorStack[operatorStack.length - 1];
      }
      if (!topOp) {
        throw new Error("Mismatched parentheses (missing '(').");
      }
      operatorStack.pop(); // Pop the left parenthesis
    }
  }

  while (operatorStack.length > 0) {
    const topOp = operatorStack[operatorStack.length - 1];
    if (topOp.type === "LPAREN") {
      throw new Error("Mismatched parentheses (unclosed '(').");
    }
    outputQueue.push(operatorStack.pop()!);
  }

  return outputQueue;
}

/**
 * Compiles a formula string into a fast multi-variable evaluation function.
 * Returns the compiled function that takes an object of live variables.
 */
export function compileFormula(formulaStr: string): (variables: Record<string, number> | number) => number {
  if (!formulaStr || formulaStr.trim() === "") {
    return (variables: Record<string, number> | number) => {
      if (typeof variables === "number") return variables;
      return variables["raw"] || 0;
    };
  }

  const tokens = tokenize(formulaStr);
  const postfix = shuntingYard(tokens);

  // Dry-run test evaluation using dummy data to guarantee compilation safety
  const dummyData: Record<string, number> = {
    speed: 1.0,
    rpm: 1.0,
    throttle: 1.0,
    suspension: 1.0,
    invertertemp: 1.0,
    motortemp: 1.0,
    voltage: 1.0,
    lambda: 1.0,
    satellites: 1.0,
    raw: 1.0
  };
  evaluatePostfix(postfix, dummyData);

  // Return compiled RPN hot-path evaluator
  return (variables: Record<string, number> | number): number => {
    if (typeof variables === "number") {
      return evaluatePostfix(postfix, { raw: variables });
    }
    // Standardize key casings to lowercase for case-insensitivity
    const lowerVars: Record<string, number> = {};
    Object.keys(variables).forEach((k) => {
      lowerVars[k.toLowerCase()] = variables[k];
    });
    // Set raw fallback
    if (lowerVars["raw"] === undefined) {
      lowerVars["raw"] = 0;
    }
    return evaluatePostfix(postfix, lowerVars);
  };
}

/**
 * High-performance Postfix RPN stack evaluator.
 */
function evaluatePostfix(postfix: Token[], variables: Record<string, number>): number {
  const stack: number[] = [];

  for (const token of postfix) {
    if (token.type === "NUMBER") {
      const val = parseFloat(token.value);
      if (isNaN(val)) throw new Error(`Invalid numeric token: "${token.value}"`);
      stack.push(val);
    } else if (token.type === "VARIABLE") {
      const val = variables[token.value] !== undefined ? variables[token.value] : variables["raw"] || 0;
      stack.push(val);
    } else if (token.type === "OPERATOR") {
      if (stack.length < 2) {
        throw new Error("Malformed formula: missing operands.");
      }
      const b = stack.pop()!;
      const a = stack.pop()!;

      switch (token.value) {
        case "+":
          stack.push(a + b);
          break;
        case "-":
          stack.push(a - b);
          break;
        case "*":
          stack.push(a * b);
          break;
        case "/":
          if (b === 0) {
            stack.push(0); // Gracefully prevent division by zero in charts
          } else {
            stack.push(a / b);
          }
          break;
        default:
          throw new Error(`Unsupported operator: "${token.value}"`);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error("Malformed expression syntax (invalid operator/operand pairing).");
  }

  return stack[0];
}
