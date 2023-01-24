const _ = require('lodash')
const prettier = require('prettier')
const buildAST = require('./ast')

function pretty(string) {
  return prettier.format(string, {
    semi: false,
    parser: 'typescript',
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 72,
    tabWidth: 2,
    useTabs: false,
    arrowParens: 'avoid',
    quoteProps: 'as-needed',
    bracketSpacing: true,
    proseWrap: 'always',
    endOfLine: 'lf',
    singleAttributePerLine: true,
    importOrder: [
      '^\\w(.*)$',
      '^@(.*)$',
      '~(.*)$',
      '\\..(.*)$',
      '\\.(.*)$',
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
  })
}

function convert(string) {
  const tree = buildAST(string)
  const body = []
  const module = [body]
  const state = {
    path: [],
    module,
    body,
  }

  tree.body.forEach(node => {
    process({ ...state, node })
  })

  const out = []
  state.module.forEach(body => {
    let text = body.join('\n')
    try {
      text = pretty(text)
    } catch (e) {
      // couldn't make it pretty :/
      // but you still get the output.
    }
    out.push(text)
  })

  return out.join('\n')
}

function process(input) {
  switch (input.node.type) {
    case 'assignment':
      processAssignment(input)
      break
    case 'string':
      processString(input)
      break
    case 'function_definition':
      processFunctionDefinition(input)
      break
    case 'return_statement':
      processReturnStatement(input)
      break
    case 'call':
      processCall(input)
      break
    case 'binary_operator':
      processBinaryOperator(input)
      break
    case 'if_statement':
      break
    case 'reference':
      processReference(input)
      break
    case 'parenthesized_expression':
      processParenthesizedExpression(input)
      break
    case 'integer':
      processInteger(input)
      break
    case 'float':
      processFloat(input)
      break
    case 'keyword_argument':
      break
    case 'unary_operator':
      break
    case 'member_expression':
      processMemberExpression(input)
      break
    default:
      throwNode(input.node)
  }
}

function processMemberExpression(input) {}

function processCall(input) {
  const object = []
  process({ ...input, node: input.node.attribute, body: object })

  const args = []
  input.node.args.forEach(node => {
    const arg = []
    args.push(arg)
    process({ ...input, node, body: arg })
  })

  input.body.push(
    `${object.join('')}(${args.map(arg => arg.join('\n')).join(', ')})`,
  )
}

function processString(input) {
  if (input.node.value.match(/^r?"""/)) {
    input.body.push(
      '`' +
        input.node.value
          .replace(/^r?"""/, '')
          .replace(/"""$/, '')
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`') +
        '`',
    )
  } else {
    input.body.push(input.node.value)
  }
}

function processFloat(input) {
  input.body.push(input.node.value)
}

function processInteger(input) {
  input.body.push(input.node.value)
}

function processBinaryOperator(input) {
  const left = []
  process({ ...input, node: input.node.left, body: left })

  const right = []
  process({ ...input, node: input.node.right, body: right })

  input.body.push(
    `${left.join(' ')} ${input.node.operator} ${right.join(' ')}`,
  )
}

function processReference(input) {
  input.body.push(input.node.name)
}

function processParenthesizedExpression(input) {
  const body = []
  process({ ...input, node: input.node.expression, body })

  input.body.push(`(${body.join(' ')})`)
}

function processReturnStatement(input) {
  const statement = []
  process({ ...input, node: input.node.statement, body: statement })

  if (statement.length === 1) {
    input.body.push(`return ${statement.join('')}`)
  } else {
    input.body.push(`return (`)
    statement.forEach(line => {
      input.body.push(`  ${line}`)
    })
    input.body.push(')')
  }
}

function processFunctionDefinition(input) {
  const { name, returnType } = input.node
  const params = []
  input.node.parameters.forEach(node => {
    let type = getTypeName(node.typeName)
    params.push(`${_.camelCase(node.name)}${type ? `: ${type}` : ``}`)
  })

  const body = []
  input.node.body.forEach(node => {
    process({ ...input, node, body, scope: 'function' })
  })

  const type = getTypeName(returnType)

  input.body.push(
    `function ${_.camelCase(name)}(${params.join(', ')})${
      type ? `: ${type}` : ``
    } {`,
  )

  body.forEach(line => {
    input.body.push(`  ${line}`)
  })

  input.body.push('}')
}

function processAssignment(input) {}

function throwNode(node, ctx) {
  console.log(node)
  throw new Error(
    `Unhandled node type '${node.type}' in context '${
      ctx?.type ?? 'file'
    }'`,
  )
}

module.exports = convert

convert.pretty = pretty

function getName(name, { path, scope }) {
  switch (scope) {
    case 'namespace': {
      const parts = path.concat()
      parts.push(name)
      return parts.join('_')
    }
    default:
      return name
  }
}

function logJSON(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

function pascalCase(str) {
  return _.startCase(_.camelCase(str)).replace(/ /g, '')
}

function getTypeName(name) {
  switch (name) {
    case 'int':
      return 'number'
    case 'number':
      return 'number'
    case 'void':
      return 'void'
    default:
      return pascalCase(name)
  }
}
