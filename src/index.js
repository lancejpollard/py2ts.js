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
    default:
      throwNode(input.node)
  }
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
