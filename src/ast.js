const Parser = require('tree-sitter')
const python = require('tree-sitter-python')

const parser = new Parser()
parser.setLanguage(python)

module.exports = build

function build(string) {
  const tree = parser.parse(string)
  const body = []

  body.push(...process({ node: tree.rootNode, scope: 'module' }))

  return { type: 'program', body }
}

function process(input) {
  const body = []
  switch (input.node.type) {
    case 'module':
      body.push(...processModule(input))
      break
    default:
      throwNode(input.node)
  }
  return body
}

function processAttribute(input) {
  let expression
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'identifier':
        if (!expression) {
          expression = {
            type: 'reference',
            name: node.text,
          }
        } else {
          expression = {
            type: 'member_expression',
            object: expression,
            property: {
              type: 'reference',
              name: node.text,
            },
          }
        }
        break
      case 'parenthesized_expression':
        if (!expression) {
          expression = processParenthesizedExpression({
            ...input,
            node,
          })
        } else {
          expression = {
            type: 'member_expression',
            object: expression,
            property: processParenthesizedExpression({
              ...input,
              node,
            }),
          }
        }
        break
      case 'attribute':
        if (!expression) {
          expression = processAttribute({ ...input, node })
        } else {
          expression = {
            type: 'member_expression',
            object: expression,
            property: processAttribute({ ...input, node }),
          }
        }
        break
      case '.':
        break
      case 'call':
        if (!expression) {
          expression = processCall({ ...input, node })
        } else {
          expression = {
            type: 'member_expression',
            object: expression,
            property: processCall({ ...input, node }),
          }
        }
        break
      default:
        throwNode(node, input.node)
    }
  })

  return expression
}

function processPair(input) {
  const info = { type: 'pair' }
  const parts = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'attribute':
        parts.push(processAttribute({ ...input, node }))
        break
      case ':':
        break
      case 'float':
        parts.push(processFloat({ ...input, node }))
        break
      case 'string':
        parts.push(processString({ ...input, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })

  info.left = parts.shift()
  info.right = parts.shift()

  return info
}

function processParenthesizedExpression(input) {
  const info = {
    type: 'parenthesized_expression',
    expression: undefined,
  }
  input.node.children.forEach(node => {
    switch (node.type) {
      case '(':
      case ')':
      case 'comment':
        break
      case 'call':
        info.expression = processCall({ ...input, node })
        break
      case 'binary_operator':
        info.expression = processBinaryOperator({ ...input, node })
        break
      case 'comparison_operator':
        info.expression = processComparisonOperator({ ...input, node })
        break
      case 'attribute':
        info.expression = processAttribute({ ...input, node })
        break
      case 'identifier':
        info.expression = {
          type: 'reference',
          name: node.text,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processDictionary(input) {
  const info = { type: 'dictionary', properties: [] }
  input.node.children.forEach(node => {
    switch (node.type) {
      case '{':
      case '}':
      case ',':
        break
      case 'pair':
        info.properties.push(processPair({ ...input, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processList(input) {
  const info = { type: 'list', items: [] }
  let i = 0
  input.node.children.forEach(node => {
    switch (node.type) {
      case '[':
      case ']':
        break
      case ',':
        info.items[++i] = undefined
        break
      case 'identifier':
        info.items[i] = {
          type: 'reference',
          name: node.text,
        }
        break
      case 'float':
        info.items[i] = processFloat({ ...input, node })
        break
      case 'string':
        info.items[i] = processString({ ...input, node })
        break
      case 'unary_operator':
        info.items[i] = processUnaryOperator({ ...input, node })
        break
      case 'binary_operator':
        info.items[i] = processBinaryOperator({ ...input, node })
        break
      case 'attribute':
        info.items[i] = processAttribute({ ...input, node })
        break
      case 'integer':
        info.items[i] = processInteger({ ...input, node })
        break
      case 'none':
        info.items[i] = processNone({ ...input, node })
        break
      case 'true':
      case 'false':
        info.items[i] = {
          type: 'boolean',
          value: node.type,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processSubscript(input) {
  const info = { type: 'path', children: [] }
  let index
  input.node.children.forEach(node => {
    switch (node.type) {
      case ',':
        break
      case '[':
        index = {}
        info.children.push(index)
        break
      case ']':
        index = undefined
        break
      case 'attribute':
        if (index) {
          index.expression = processAttribute({ ...input, node })
        } else {
          info.children.push(processAttribute({ ...input, node }))
        }
        break
      case 'slice':
        // TODO: x[:,-1]
        break
      case 'identifier':
        if (index) {
          index.expression = {
            type: 'reference',
            name: node.text,
          }
        } else {
          info.children.push({
            type: 'reference',
            name: node.text,
          })
        }
        break
      case 'unary_operator':
        index.expression = processUnaryOperator({ ...input, node })
        break
      case 'binary_operator':
        index.expression = processBinaryOperator({ ...input, node })
        break
      case 'none':
        index.expression = processNone({ ...input, node })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processAssignment(input) {
  const info = { type: 'assignment' }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'identifier':
        info.left = {
          type: 'reference',
          name: node.text,
        }
        break
      case '=':
      case '*=':
      case '+=':
      case '-=':
      case '/=':
      case '>>=':
      case '<<=':
        info.operator = node.type
        break
      case 'pattern_list':
        info.left = processPatternList({ ...input, node })
        break
      case 'subscript':
        if (!input.left) {
          info.right = processSubscript({ ...input, node })
        } else {
          info.right = processSubscript({ ...input, node })
        }
        break
      case 'float':
        info.right = processFloat({ ...input, node })
        break
      case 'dictionary':
        info.right = processDictionary({ ...input, node })
        break
      case 'parenthesized_expression':
        info.right = processParenthesizedExpression({ ...input, node })
        break
      case 'binary_operator':
        info.right = processBinaryOperator({ ...input, node })
        break
      case 'comparison_operator':
        info.right = processComparisonOperator({ ...input, node })
        break
      case 'tuple_pattern':
        if (!input.left) {
          info.right = processTuplePattern({ ...input, node })
        } else {
          info.right = processTuplePattern({ ...input, node })
        }
        break
      case 'attribute':
        if (!input.left) {
          input.left = processAttribute({ ...input, node })
        } else {
          info.right = processAttribute({ ...input, node })
        }
        break
      case 'call':
        info.right = processCall({ ...input, node })
        break
      case 'none':
        info.right = processNone({ ...input, node })
        break
      case 'conditional_expression':
        info.right = processConditionalExpression({ ...input, node })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processFloat(input) {
  return {
    type: 'float',
    value: input.node.text,
  }
}

function processString(input) {
  if (
    input.scope.match(
      /module|function|class|if_statement|for_statement/,
    ) &&
    input.node.text.match(/^r?"""/)
  ) {
    return {
      type: 'comment',
      text:
        '`' +
        input.node.text.replace(/^r?"""/, '').replace(/"""$/, '') +
        // .replace(/\\/g, '\\\\')
        // .replace(/`/g, '\\`') +
        '`',
    }
  }
  return {
    type: 'string',
    value: input.node.text,
  }
}

function processUnaryOperator(input) {
  return { type: 'unary_operator', value: input.node.text }
}

function processInteger(input) {
  return { type: 'integer', value: input.node.text }
}

function processNone(input) {
  return { type: 'null', value: input.node.text }
}

function processConditionalExpression(input) {
  let sides = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'if':
      case 'else':
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'subscript':
        sides.push(processSubscript({ ...input, node }))
        break
      case 'unary_operator':
        sides.push(processUnaryOperator({ ...input, node }))
        break
      case 'comparison_operator':
        sides.push(processComparisonOperator({ ...input, node }))
        break
      case 'binary_operator':
        sides.push(processBinaryOperator({ ...input, node }))
        break
      case 'attribute':
        sides.push(processAttribute({ ...input, node }))
        break
      case 'integer':
        sides.push(processInteger({ ...input, node }))
        break
      case 'call':
        sides.push(processCall({ ...input, node }))
        break
      case 'float':
        sides.push(processFloat({ ...input, node }))
        break
      case 'parenthesized_expression':
        sides.push(processParenthesizedExpression({ ...input, node }))
        break
      case 'none':
        sides.push(processNone({ ...input, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  const info = {
    type: 'conditional_expression',
    success: sides.shift(),
    test: sides.shift(),
    failure: sides.shift(),
  }
  return info
}

function processBinaryOperator(input) {
  const childInput = { ...input, scope: 'binary' }
  let sides = []
  let op
  input.node.children.forEach(node => {
    switch (node.type) {
      case '(':
      case ')':
        break
      case '*':
      case '/':
      case '+':
      case '-':
      case '%':
      case '>':
      case '>=':
      case '<':
      case '<=':
      case '**':
      case '!=':
      case '==':
      case '&&':
      case '||':
      case '&':
      case '|':
      case '>>':
      case '<<':
        op = node.type
        break
      case 'and':
        op = '&&'
        break
      case 'or':
        op = '||'
        break
      case 'is':
        op = '=='
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'subscript':
        sides.push(processSubscript({ ...childInput, node }))
        break
      case 'unary_operator':
        sides.push(processUnaryOperator({ ...childInput, node }))
        break
      case 'comparison_operator':
        sides.push(processComparisonOperator({ ...childInput, node }))
        break
      case 'binary_operator':
        sides.push(processBinaryOperator({ ...childInput, node }))
        break
      case 'attribute':
        sides.push(processAttribute({ ...childInput, node }))
        break
      case 'integer':
        sides.push(processInteger({ ...childInput, node }))
        break
      case 'call':
        sides.push(processCall({ ...childInput, node }))
        break
      case 'float':
        sides.push(processFloat({ ...childInput, node }))
        break
      case 'parenthesized_expression':
        sides.push(
          processParenthesizedExpression({ ...childInput, node }),
        )
        break
      case 'none':
        sides.push(processNone({ ...childInput, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  const info = {
    type: 'binary_operator',
    left: sides.shift(),
    right: sides.shift(),
    operator: op,
  }
  return info
}

function processArgumentList(input) {
  const childInput = { ...input, scope: 'argument_list' }
  let args = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case '(':
      case ')':
      case ',':
        break
      case 'tuple':
        args.push(processTuplePattern({ ...childInput, node }))
        break
      case 'list_splat':
        args.push(processListSplat({ ...childInput, node }))
        break
      case 'dictionary_splat':
        args.push(processDictionarySplat({ ...childInput, node }))
        break
      case 'unary_operator':
        args.push(processUnaryOperator({ ...childInput, node }))
        break
      case 'binary_operator':
        args.push(processBinaryOperator({ ...childInput, node }))
        break
      case 'attribute':
        args.push(processAttribute({ ...childInput, node }))
        break
      case 'integer':
        args.push(processInteger({ ...childInput, node }))
        break
      case 'float':
        args.push(processFloat({ ...childInput, node }))
        break
      case 'string':
        args.push(processString({ ...childInput, node }))
        break
      case 'identifier':
        args.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'call':
        args.push(processCall({ ...childInput, node }))
        break
      case 'keyword_argument':
        args.push(processKeywordArgument({ ...childInput, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  return args
}

function processKeywordArgument(input) {
  let info = { type: 'keyword_argument' }
  let sides = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case '=':
        break
      case 'attribute':
        sides.push(processAttribute({ ...input, node }))
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'tuple':
        sides.push(processTuplePattern({ ...input, node }))
        break
      case 'true':
      case 'false':
        sides.push({
          type: 'boolean',
          value: node.type,
        })
        break
      case 'float':
        sides.push(processFloat({ ...input, node }))
        break
      case 'string':
        sides.push(processString({ ...input, node }))
        break
      case 'unary_operator':
        sides.push(processUnaryOperator({ ...input, node }))
        break
      case 'binary_operator':
        sides.push(processBinaryOperator({ ...input, node }))
        break
      case 'integer':
        sides.push(processInteger({ ...input, node }))
        break
      case 'none':
        sides.push(processNone({ ...input, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  info.left = sides.shift()
  info.right = sides.shift()
  return info
}

function processTuplePattern(input) {
  let info = { type: 'tuple', values: [] }
  let i = 0
  input.node.children.forEach(node => {
    switch (node.type) {
      case '(':
      case ')':
        break
      case 'attribute':
        info.values[i] = processAttribute({ ...input, node })
        break
      case 'list':
        info.values[i] = processList({ ...input, node })
        break
      case 'identifier':
        info.values[i] = {
          type: 'reference',
          name: node.text,
        }
        break
      case ',':
        info.values[++i] = undefined
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processCall(input) {
  let info = { type: 'call' }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'attribute':
        info.attribute = processAttribute({ ...input, node })
        break
      case 'argument_list':
        info.args = processArgumentList({ ...input, node })
        break
      case 'identifier':
        info.attribute = {
          type: 'reference',
          name: node.text,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processPatternList(input) {
  let info = { type: 'pattern_list', children: [] }
  input.node.children.forEach(node => {
    switch (node.type) {
      case ',':
        break
      case 'identifier':
        info.children.push({
          type: 'reference',
          name: node.text,
        })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processReturnStatement(input) {
  let info = { type: 'return_statement' }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'return':
        break
      case 'call':
        info.statement = processCall({ ...input, node })
        break
      case 'parenthesized_expression':
        info.statement = processParenthesizedExpression({
          ...input,
          node,
        })
        break
      case 'binary_operator':
        info.statement = processBinaryOperator({ ...input, node })
        break
      case 'unary_operator':
        info.statement = processUnaryOperator({ ...input, node })
        break
      case 'identifier':
        info.statement = {
          type: 'reference',
          name: node.text,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processRaiseStatement(input) {
  let info = { type: 'raise_statement' }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'raise':
        break
      case 'call': {
        info.statement = processCall({ ...input, node })
        break
      }
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processForStatement(input) {
  const childInput = { ...input, scope: 'for_statement' }
  let info = { type: 'for_statement' }
  const sides = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'for':
      case 'in':
      case ':':
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'block':
        info.body = processBlock({ ...childInput, node })
        break
      default:
        throwNode(node, input.node)
    }
  })
  info.left = sides.shift()
  info.right = sides.shift()
  return info
}

function processDecoratedDefinition(input) {
  let info = {}
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'decorator':
        info.decorator = node.text
        break
      case 'function_definition': {
        info.type = 'function_definition'
        const def = processFunctionDefinition({ ...input, node })
        info.name = def.name
        info.parameters = def.parameters
        info.body = def.body
        break
      }
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processBlock(input) {
  let body = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'comment':
        break
      case 'import_statement':
        // Not yet...
        break
      case 'raise_statement':
        body.push(processRaiseStatement({ ...input, node }))
        break
      case 'for_statement':
        body.push(processForStatement({ ...input, node }))
        break
      case 'return_statement':
        body.push(processReturnStatement({ ...input, node }))
        break
      case 'expression_statement':
        body.push(processExpressionStatement({ ...input, node }))
        break
      case 'decorated_definition':
        body.push(processDecoratedDefinition({ ...input, node }))
        break
      case 'if_statement':
        body.push(processIfStatement({ ...input, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  return body
}

function processComparisonOperator(input) {
  return processBinaryOperator(input)
}

function processNotOperator(input) {
  let info = { type: 'not_operator', expression: undefined }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'not':
        break
      case 'unary_operator':
        info.expression = processUnaryOperator({ ...input, node })
        break
      case 'binary_operator':
        info.expression = processBinaryOperator({ ...input, node })
        break
      case 'attribute':
        info.expression = processAttribute({ ...input, node })
        break
      case 'identifier':
        info.expression = {
          type: 'reference',
          name: node.text,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processIfStatement(input) {
  const childInput = { ...input, scope: 'if_statement' }
  let info = { type: 'if_statement', choices: [] }
  let choice
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'if':
      case ':':
      case 'comment':
        break
      case 'identifier':
        choice = {}
        choice.test = {
          type: 'reference',
          name: node.text,
        }
        info.choices.push(choice)
        break
      case 'not_operator':
        choice = {}
        choice.test = processNotOperator({ ...childInput, node })
        info.choices.push(choice)
        break
      case 'comparison_operator':
        choice = {}
        choice.test = processComparisonOperator({ ...childInput, node })
        info.choices.push(choice)
        break
      case 'boolean_operator':
        choice = {}
        choice.test = processComparisonOperator({ ...childInput, node })
        info.choices.push(choice)
        break
      case 'call':
        choice = {}
        choice.test = processCall({ ...childInput, node })
        info.choices.push(choice)
        break
      case 'block':
        choice.statements = processBlock({ ...childInput, node })
        break
      case 'else_clause':
        choice = processElseClause({ ...childInput, node })
        info.choices.push(choice)
        break
      case 'elif_clause':
        choice = processElifClause({ ...childInput, node })
        info.choices.push(choice)
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processElifClause(input) {
  let choice = {}
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'elif':
      case ':':
        break
      case 'call':
        choice.test = processCall({ ...input, node })
        break
      case 'not_operator':
        choice.test = processNotOperator({ ...input, node })
        break
      case 'comparison_operator':
        choice.test = processComparisonOperator({ ...input, node })
        break
      case 'boolean_operator':
        choice.test = processComparisonOperator({ ...input, node })
        break
      case 'block':
        choice.statements = processBlock({ ...input, node })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return choice
}

function processElseClause(input) {
  let choice = {}
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'else':
      case ':':
        break
      case 'block':
        choice.statements = processBlock({ ...input, node })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return choice
}

function processExpressionStatement(input) {
  let statement
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'assignment':
      case 'augmented_assignment':
        statement = processAssignment({ ...input, node })
        break
      case 'dictionary':
        statement = processDictionary({ ...input, node })
        break
      case 'call':
        statement = processCall({ ...input, node })
        break
      case 'string':
        statement = processString({ ...input, node })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return statement
}

function processImportStatement(input) {
  // no support for this for now.
}

function processFunctionDefinition(input) {
  const info = { type: 'function_definition', parameters: [], body: [] }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'def':
        break
      case 'identifier':
        if (!info.name) {
          info.name = node.text
        } else {
          throwNode(node, input.node)
        }
        break
      case ':':
        break
      case 'parameters':
        info.parameters.push(
          ...processParameters({ ...input, node, scope: 'function' }),
        )
        break
      case 'block':
        info.body.push(
          ...processBlock({ ...input, node, scope: 'function' }),
        )
        break
      case 'comment':
        break
      case 'function_definition':
        info.body.push(
          processFunctionDefinition({
            ...input,
            node,
            scope: 'function',
          }),
        )
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processClassDefinition(input) {
  const info = { type: 'class_definition' }
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'comment':
      case 'class':
      case ':':
        break
      case 'identifier':
        if (!info.name) {
          info.name = {
            type: 'reference',
            name: node.text,
          }
        } else {
          throwNode(node, input.node)
        }
        break
      case 'argument_list':
        info.args = processArgumentList({
          ...input,
          node,
          scope: 'class',
        })
        break
      case 'block':
        info.body = processBlock({ ...input, node, scope: 'class' })
        break
      default:
        throwNode(node, input.node)
    }
  })
  return info
}

function processDefaultParameter(input) {
  let sides = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case '=':
      case 'comment':
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'float':
        sides.push(processFloat({ ...input, node }))
        break
      case 'string':
        sides.push(processString({ ...input, node }))
        break
      case 'unary_operator':
        sides.push(processUnaryOperator({ ...input, node }))
        break
      case 'binary_operator':
        sides.push(processBinaryOperator({ ...input, node }))
        break
      case 'attribute':
        sides.push(processAttribute({ ...input, node }))
        break
      case 'integer':
        sides.push(processInteger({ ...input, node }))
        break
      case 'none':
        sides.push(processNone({ ...input, node }))
        break
      case 'true':
      case 'false':
        sides.push({
          type: 'boolean',
          value: node.type,
        })
        break
      default:
        throwNode(node, input.node)
    }
  })

  const info = {
    type: 'default_parameter',
    left: sides.shift(),
    right: sides.shift(),
  }
  return info
}

function processTypedParameter(input) {
  let sides = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case ':':
        break
      case 'comment':
        break
      case 'list_splat_pattern':
        sides.push(processListSplatPattern({ ...input, node }))
        break
      case 'dictionary_splat_pattern':
        sides.push(processDictionarySplatPattern({ ...input, node }))
        break
      case 'keyword_separator':
        // https://stackoverflow.com/questions/14301967/bare-asterisk-in-function-parameters
        // don't care about that.
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'type':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      default:
        throwNode(node, input.node)
    }
  })

  const info = {
    type: 'typed_parameter',
    left: sides.shift(),
    leftType: sides.shift(),
  }

  return info
}

function processTypedDefaultParameter(input) {
  let sides = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case '=':
      case ':':
        break
      case 'comment':
        break
      case 'identifier':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'type':
        sides.push({
          type: 'reference',
          name: node.text,
        })
        break
      case 'float':
        sides.push(processFloat({ ...input, node }))
        break
      case 'string':
        sides.push(processString({ ...input, node }))
        break
      case 'unary_operator':
        sides.push(processUnaryOperator({ ...input, node }))
        break
      case 'binary_operator':
        sides.push(processBinaryOperator({ ...input, node }))
        break
      case 'attribute':
        sides.push(processAttribute({ ...input, node }))
        break
      case 'integer':
        sides.push(processInteger({ ...input, node }))
        break
      case 'none':
        sides.push(processNone({ ...input, node }))
        break
      case 'true':
      case 'false':
        sides.push({
          type: 'boolean',
          value: node.type,
        })
        break
      default:
        throwNode(node, input.node)
    }
  })

  const info = {
    type: 'default_parameter',
    left: sides.shift(),
    leftType: sides.shift(),
    right: sides.shift(),
  }

  return info
}

function processListSplat(input) {
  let arg
  input.node.children.forEach(node => {
    switch (node.type) {
      case '*':
      case 'comment':
        break
      case 'identifier':
        arg = {
          type: 'reference',
          name: node.text,
          splat: true,
          isList: true,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return arg
}

function processListSplatPattern(input) {
  let parameter
  input.node.children.forEach(node => {
    switch (node.type) {
      case '*':
      case 'comment':
        break
      case 'identifier':
        parameter = {
          type: 'reference',
          name: node.text,
          splat: true,
          isList: true,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return parameter
}

function processDictionarySplatPattern(input) {
  let parameter
  input.node.children.forEach(node => {
    switch (node.type) {
      case '**':
      case 'comment':
        break
      case 'identifier':
        parameter = {
          type: 'reference',
          name: node.text,
          splat: true,
          isDictionary: true,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return parameter
}

function processDictionarySplat(input) {
  let arg
  input.node.children.forEach(node => {
    switch (node.type) {
      case '**':
      case 'comment':
        break
      case 'identifier':
        arg = {
          type: 'reference',
          name: node.text,
          splat: true,
          isDictionary: true,
        }
        break
      default:
        throwNode(node, input.node)
    }
  })
  return arg
}

function processParameters(input) {
  const childInput = { ...input, scope: 'parameters' }
  const parameters = []
  let parameter
  input.node.children.forEach(node => {
    switch (node.type) {
      case '(':
      case ')':
      case ',':
      case 'comment':
        break
      case 'list_splat_pattern':
        parameter = processListSplatPattern({ ...childInput, node })
        parameters.push(parameter)
        break
      case 'dictionary_splat_pattern':
        parameter = processDictionarySplatPattern({
          ...childInput,
          node,
        })
        parameters.push(parameter)
        break
      case 'keyword_separator':
        // https://stackoverflow.com/questions/14301967/bare-asterisk-in-function-parameters
        // don't care about that.
        break
      case 'typed_parameter':
        parameter = processTypedParameter({ ...childInput, node })
        parameters.push(parameter)
        break
      case 'typed_default_parameter':
        parameter = processTypedDefaultParameter({
          ...childInput,
          node,
        })
        parameters.push(parameter)
        break
      case 'default_parameter':
        parameter = processDefaultParameter({ ...childInput, node })
        parameters.push(parameter)
        break
      case 'identifier':
        parameter = {
          type: 'reference',
          name: node.text,
        }
        parameters.push(parameter)
        break
      default:
        throwNode(node, input.node)
    }
  })
  return parameters
}

function processModule(input) {
  const body = []
  input.node.children.forEach(node => {
    switch (node.type) {
      case 'expression_statement':
        body.push(processExpressionStatement({ ...input, node }))
        break
      case 'import_statement':
      case 'import_from_statement':
        processImportStatement(input)
        break
      case 'comment':
        break
      case 'decorated_definition':
        body.push(processDecoratedDefinition({ ...input, node }))
        break
      case 'function_definition':
        body.push(processFunctionDefinition({ ...input, node }))
        break
      case 'class_definition':
        body.push(processClassDefinition({ ...input, node }))
        break
      default:
        throwNode(node, input.node)
    }
  })
  return body
}

function throwNode(node, ctx) {
  console.log(node.text)
  throw new Error(
    `Unhandled node type '${node.type}' in context '${
      ctx?.type ?? 'file'
    }'`,
  )
}

function logJSON(obj) {
  console.log(JSON.stringify(obj, null, 2))
}
