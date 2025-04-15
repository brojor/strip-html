import type { ChildNode, Element, Node } from 'domhandler'
import * as fs from 'node:fs'
import process from 'node:process'
import { Command } from 'commander'
import * as DomSerializer from 'dom-serializer'
import { parseDocument } from 'htmlparser2'
import { description, name, version } from '../package.json'

function stripAndClean(nodes: Node[]): ChildNode[] {
  return nodes.filter((node): node is ChildNode => {
    if (node.type === 'script' || node.type === 'style')
      return false

    if (node.type === 'tag') {
      (node as Element).attribs = {}
    }

    if ('children' in node) {
      node.children = stripAndClean(node.children as Node[])
    }

    return true
  })
}

function processHtml(inputHtml: string, { keepWhitespace = false } = {}): string {
  const dom = parseDocument(inputHtml)
  dom.children = stripAndClean(dom.children)

  const result = DomSerializer.default(dom)

  return keepWhitespace
    ? result
    : result
        .replace(/\s{2,}/g, ' ')
        .replace(/>\s+</g, '><')
        .replace(/\n/g, '')
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => data += chunk)
    process.stdin.on('end', () => resolve(data))
  })
}

function readFile(path: string): Promise<string> {
  return fs.promises.readFile(path, 'utf8')
}

function writeFile(path: string, content: string): Promise<void> {
  return fs.promises.writeFile(path, content)
}

async function main(): Promise<void> {
  const program = new Command()
    .name(name)
    .description(description)
    .version(version)
    .option('-k, --keep-whitespace', 'Keep whitespace and newlines in HTML')
    .option('-o, --output <file>', 'Output file (if not specified, stdout will be used)')
    .argument('[input file]', 'Input HTML file (if not specified, stdin will be used)')
    .parse(process.argv)

  const { keepWhitespace, output: outputFile } = program.opts()
  const [inputFile] = program.processedArgs || program.args

  try {
    const inputHtml = inputFile
      ? await readFile(inputFile)
      : process.stdin.isTTY
        ? (program.help(), process.exit(0))
        : await readStdin()

    const outputHtml = processHtml(inputHtml, { keepWhitespace })

    if (outputFile) {
      await writeFile(outputFile, outputHtml)
    }
    else {
      process.stdout.write(outputHtml)
    }
  }
  catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
