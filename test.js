const _ = require('lodash')
const fs = require('fs')
const convert = require('./src')
const print = require('./src/print')

async function start() {
  if (!fs.existsSync('tmp')) {
    fs.mkdirSync('tmp')
  }
  fs.writeFileSync(
    'fixtures/stereographic.ast.json',
    JSON.stringify(
      print(fs.readFileSync('fixtures/stereographic.py', 'utf-8')),
      null,
      2,
    ),
  )

  // fs.writeFileSync('hyperpoint.2.json', JSON.stringify(traverse(ast), null, 2))
  fs.writeFileSync(
    'tmp/stereographic.ts',
    convert(fs.readFileSync('fixtures/stereographic.py', 'utf-8')),
  )

  // await convert.lint('tmp/stereographic.ts')
}

start()
