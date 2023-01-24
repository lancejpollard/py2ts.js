const Parser = require('tree-sitter')
const python = require('tree-sitter-python')

const parser = new Parser()
parser.setLanguage(python)

module.exports = build

function build(string) {
  const tree = parser.parse(string)
  const body = []

  body.push(...process({ node: tree.rootNode }))

  return { type: 'program', body }
}

function process(input) {
  const body = []
  switch (input.node.type) {
    case 'module':
      break
    default:
      throwNode(input.node)
  }
  return body
}

function throwNode(node, ctx) {
  console.log(node)
  throw new Error(
    `Unhandled node type '${node.type}' in context '${
      ctx?.type ?? 'file'
    }'`,
  )
}

function logJSON(obj) {
  console.log(JSON.stringify(obj, null, 2))
}