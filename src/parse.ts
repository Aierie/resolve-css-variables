import parser, {
  FunctionNode,
  Node,
  WordNode
} from 'postcss-value-parser';

export function parseString(value: string): Node[] {
  return parser(value).nodes;
}

function isVar(node: Node): node is FunctionNode {
  return node.type === "function" && node.value === "var";
}

export function resolveFromLookups(remaining: Record<string, Node[]>, resolved: Record<string, string>, failed: Record<string, true>, variableName: string): WordNode | null {
  // for (let variableName in remaining) {
  //   if (resolved[variableName] || failed[variableName]) continue;
  //   resolveFromLookups(remaining, resolved, failed, variableName);
  // }

  if (resolved[variableName] !== null && resolved[variableName] !== undefined) {
    return { type: 'word', value: resolved[variableName] } as WordNode;
  } 
  
  if (failed[variableName]) {
    return null;
  } 
  
  if (remaining[variableName]) {
    let resolvedNode = resolveNodeArray(remaining, resolved, failed, remaining[variableName]);

    if (!resolvedNode) {
      failed[variableName] = true;
      return null;
    }

    resolved[variableName] = resolvedNode.value;
    return resolvedNode;
  } 

  return null;
}

function replaceNodeContentsWith(node: Node, wordNode: WordNode){
  node.type = 'word';
  node.value = wordNode.value;
  return node as WordNode;
}

// need to walk to get to nested 'var' declarations
function resolveNodeArray(remaining: Record<string, Node[]>, resolved: Record<string, string>, failed: Record<string, true>, nodeArray: Node[]): WordNode | null {
  if (!nodeArray.length) return null;
  let terminated = false;

  parser.walk(nodeArray, function(node){
    if (terminated) return false;
    if (isVar(node)) {
      let variableName = node.nodes[0].value;
      let fallbackNodeArray = node.nodes.slice(2);
      let resolvedValue = resolveFromLookups(remaining, resolved, failed, variableName);
      if (resolvedValue) {
        replaceNodeContentsWith(node, resolvedValue);
      } else {
        failed[variableName] = true;
        if (!fallbackNodeArray.length) {
          terminated = true;
        } else {
          let fallback = resolveNodeArray(remaining, resolved, failed, fallbackNodeArray);
          if (fallback !== null) {
            replaceNodeContentsWith(node, fallback);
          } else {
            terminated = true;
          }
        }
      }
      return false;
    }
  })

  if (terminated) return null;
  else return { type: 'word', value: parser.stringify(nodeArray) } as WordNode;
}