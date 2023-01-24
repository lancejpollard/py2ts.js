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
      processModule(input)
      break
    case 'import_statement':
      processImportStatement(input)
      break
    case 'comment':
      break
    case 'expression_statement':
    default:
      throwNode(input.node)
  }
  return body
}

function processImportStatement(input) {
  // no support for this for now.
}

function processModule(input) {
  const body = []
  input.node.children.forEach(node => {
    body.push(...process({ ...input, node }))
  })
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
