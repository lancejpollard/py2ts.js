const _ = require('lodash')
const prettier = require('prettier')
const { ESLint } = require('eslint')
const buildAST = require('./ast')
const ESLINT_CONFIG = require('../eslint.code.json')

async function lint(path) {
  // 1. Create an instance.
  const eslint = new ESLint({
    fix: true,
    overrideConfig: ESLINT_CONFIG,
    useEslintrc: false,
  })

  console.log('here')
  // 2. Lint files.
  const results = await eslint.lintFiles([path])

  // 3. Format the results.
  const formatter = await eslint.loadFormatter('stylish')
  const resultText = formatter.format(results)
  console.log(resultText)
}

convert.lint = lint

function pretty(string) {
  return prettier.format(string, {
    arrowParens: 'avoid',
    bracketSpacing: true,
    endOfLine: 'lf',
    importOrder: [
      '^\\w(.*)$',
      '^@(.*)$',
      '~(.*)$',
      '\\..(.*)$',
      '\\.(.*)$',
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
    parser: 'typescript',
    printWidth: 72,
    proseWrap: 'always',
    quoteProps: 'as-needed',
    semi: false,
    singleAttributePerLine: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    useTabs: false,
  })
}

function convert(string) {
  const tree = buildAST(string)
  const body = []
  const module = [body]
  const state = {
    body,
    module,
    path: [],
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
      console.log(e)
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
    case 'comment':
      processComment(input)
      break
    case 'if_statement':
      processIfStatement(input)
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
      processKeywordArgument(input)
      break
    case 'unary_operator':
      processUnaryOperator(input)
      break
    case 'member_expression':
      processMemberExpression(input)
      break
    case 'raise_statement':
      processRaiseStatement(input)
      break
    case 'for_statement':
      processForStatement(input)
      break
    case 'boolean':
      processBoolean(input)
      break
    case 'null':
      processNull(input)
      break
    case 'tuple':
      processTuple(input)
      break
    case 'list':
      processList(input)
      break
    case 'pattern_list':
      processPatternList(input)
      break
    case 'not_operator':
      processNotOperator(input)
      break
    default:
      throwNode(input.node)
  }
}

function processUnaryOperator(input) {
  input.body.push(input.node.value)
}

function processKeywordArgument(input) {
  const left = []
  process({ ...input, body: left, node: input.node.left })

  const right = []
  process({ ...input, body: right, node: input.node.right })

  input.body.push(`${left.join(' ')}: ${right.join(' ')}`)
}

function processNotOperator(input) {
  const expression = []
  process({ ...input, body: expression, node: input.node.expression })

  input.body.push(`!${expression.join(' ')}`)
}

function processPatternList(input) {
  const children = []
  let originallyInitialized = false
  input.node.children.forEach(node => {
    const child = []
    const name = camelCase(node.name)
    input.initialized[name] = true
    process({ ...input, body: child, node, scope: 'pattern_list' })

    children.push(child)
  })

  const text = `[${children.map(child => child.join(' ')).join(', ')}]`

  input.body.push(text)
}

function processTuple(input) {
  const values = []
  input.node.values.forEach(node => {
    const value = []
    process({ ...input, body: value, node })

    values.push(value)
  })

  input.body.push(
    `[${values.map(value => value.join(' ')).join(', ')}]`,
  )
}

function processList(input) {
  const items = []
  input.node.items.forEach(node => {
    const item = []
    process({ ...input, body: item, node })

    items.push(item)
  })

  input.body.push(`[${items.map(item => item.join(' ')).join(', ')}]`)
}

function processForStatement(input) {
  const left = []
  process({
    ...input,
    body: left,
    node: input.node.left,
    scope: 'assignment',
  })

  const right = []
  process({ ...input, body: right, node: input.node.right })

  const body = []
  input.node.body.forEach(node => {
    process({
      ...input,
      body,
      node,
    })
  })

  input.body.push(`for (${left.join(', ')} of ${right.join('')}) {`)

  body.forEach(line => {
    input.body.push(`  ${line}`)
  })

  input.body.push(`}`)
}

function processRaiseStatement(input) {
  const statement = []
  process({ ...input, body: statement, node: input.node.statement })

  input.body.push(`throw new ${statement.join('')}`)
}

function processIfStatement(input) {
  input.node.choices.forEach((choice, i) => {
    const condition = []
    if (choice.test) {
      process({ ...input, body: condition, node: choice.test })
    }

    const statements = []

    choice.statements.forEach(statement => {
      process({
        ...input,
        body: statements,
        node: statement,
      })
    })

    if (i === 0) {
      input.body.push(`if (${condition.join('\n')}) {`)

      statements.forEach(line => {
        input.body.push(`  ${line}`)
      })

      input.body.push('}')
    } else {
      if (condition.length) {
        input.body.push(`else if (${condition.join('\n')}) {`)
      } else {
        input.body.push(`else {`)
      }

      statements.forEach(line => {
        input.body.push(`  ${line}`)
      })

      input.body.push('}')
    }
  })
}

function processMemberExpression(input) {
  const property = []
  process({ ...input, body: property, node: input.node.property })

  const object = []
  process({ ...input, body: object, node: input.node.object })

  input.body.push(`${object.join('')}.${property.join('')}`)
}

function processCall(input) {
  const object = []
  process({ ...input, body: object, node: input.node.attribute })

  const args = []
  const kwargs = []
  input.node.args.forEach(node => {
    const arg = []
    if (node.type === 'keyword_argument') {
      kwargs.push(arg)
    } else {
      args.push(arg)
    }
    process({ ...input, body: arg, node })
  })

  const inputs = []
  if (args.length) {
    inputs.push(args.map(arg => arg.join('\n')).join(', '))
  }
  if (kwargs.length) {
    inputs.push(`{ ${kwargs.map(arg => arg.join('\n')).join(', ')} }`)
  }

  input.body.push(`${object.join('')}(${inputs.join(', ')})`)
}

function processString(input) {
  input.body.push(input.node.value)
}

function processNull(input) {
  input.body.push('null')
}

function processBoolean(input) {
  input.body.push(input.node.value)
}

function processComment(input) {
  input.body.push(`/* ${input.node.text} */`)
}

function processFloat(input) {
  input.body.push(input.node.value)
}

function processInteger(input) {
  input.body.push(input.node.value)
}

function processBinaryOperator(input) {
  const left = []
  process({ ...input, body: left, node: input.node.left })

  const right = []
  process({ ...input, body: right, node: input.node.right })

  input.body.push(
    `${left.join(' ')} ${input.node.operator} ${right.join(' ')}`,
  )
}

function processReference(input) {
  const name = camelCase(input.node.name)
  if (input.scope === 'assignment') {
    input.initialized[name] = true
    input.body.push(name)
  } else {
    input.body.push(name)
  }
}

function processParenthesizedExpression(input) {
  const body = []
  process({ ...input, body, node: input.node.expression })

  input.body.push(`(${body.join(' ')})`)
}

function processReturnStatement(input) {
  const statement = []
  process({ ...input, body: statement, node: input.node.statement })

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
  const defaultParams = []
  const defaultParamsType = []
  const ignored = {}
  const childInput = { ...input, initialized: { ...input.initialized } }
  input.node.parameters.forEach(node => {
    let type
    let name

    if (node.type === 'reference') {
      name = camelCase(node.name)
    } else {
      type = getTypeName(node.leftType?.name)
      name = camelCase(node.left.name)
    }

    ignored[name] = true

    let deflt = []
    if (node.right) {
      process({ ...input, body: deflt, node: node.right })
    }

    const isDefaulted =
      node.type === 'default_parameter' ||
      node.type === 'typed_default_parameter'

    let text = name

    if (type) {
      if (isDefaulted) {
        defaultParamsType.push(`${name}: ${type}`)
      } else {
        text += `: ${type}`
      }
    }

    if (deflt.length) {
      text += ` = ${deflt.join('')}`
    }

    if (isDefaulted) {
      defaultParams.push(text)
    } else {
      params.push(text)
    }
  })

  const body = []
  input.node.body.forEach(node => {
    process({ ...childInput, body, node, scope: 'function' })
  })

  const type = getTypeName(returnType)

  let defaultParamsTypeName

  if (defaultParamsType.length) {
    const body = []
    defaultParamsTypeName = pascalCase(`${name}InputType`)
    body.push(`type ${defaultParamsTypeName} = {`)
    defaultParamsType.forEach(key => {
      body.push(`  ${key}`)
    })
    body.push(`}`)
    input.module.unshift(body)
  }

  const inputs = []
  if (params.length) {
    inputs.push(params.join(', '))
  }
  if (defaultParams.length) {
    let text = `{ ${defaultParams.join(', ')} }`
    if (defaultParamsType.length) {
      text += `: ${defaultParamsTypeName}`
    }
    inputs.push(text)
  }

  input.body.push(
    `function ${camelCase(name)}(${inputs.join(', ')})${
      type ? `: ${type}` : ``
    } {`,
  )

  Object.keys(childInput.initialized).forEach(key => {
    if (!ignored[key]) {
      input.body.push(`let ${key}`)
    }
  })

  body.forEach(line => {
    input.body.push(`  ${line}`)
  })

  input.body.push('}')
}

function processAssignment(input) {
  const left = []
  process({
    ...input,
    body: left,
    node: input.node.left,
    scope: 'assignment',
  })

  const right = []
  process({ ...input, body: right, node: input.node.right })

  input.body.push(
    `${left.join(' ')} ${input.node.operator} ${right.shift()}`,
  )

  right.forEach(line => {
    input.body.push(`  ${line}`)
  })
}

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
  let prefix = String(str).startsWith('_') ? '_' : ''

  return prefix + _.startCase(_.camelCase(str)).replace(/ /g, '')
}

function camelCase(str) {
  let prefix = String(str).startsWith('_') ? '_' : ''

  return prefix + _.camelCase(str)
}

function getTypeName(name) {
  switch (name) {
    case 'int':
    case 'number':
    case 'float':
    case 'integer':
      return 'number'
    case 'void':
      return 'void'
    case 'bool':
      return 'boolean'
    default:
      return pascalCase(name)
  }
}
