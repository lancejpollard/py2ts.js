const Parser = require('tree-sitter')
const python = require('tree-sitter-python')

const parser = new Parser()
parser.setLanguage(python)

module.exports = print

function print(string) {
  const tree = parser.parse(string)

  const out = walk(tree.rootNode)

  return out

  function walk(node) {
    const out = {
      type: node.type,
      text: node.text,
      children: [],
    }

    node.children?.forEach(child => {
      out.children.push(walk(child))
    })

    return out
  }
}
