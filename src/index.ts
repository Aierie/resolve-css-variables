import calc from 'reduce-css-calc';
import css from 'css';

import { parseString, resolveFromLookups, ParsedLiteral, ParsedVariable } from './parse';

/**
 * A POJO that maps css variables to values
 */
interface VariableDict<T=string> {
  [variable: string]: T
}

/**
 * Checks whether a node parsed by @reworkcss/css is a css rule
 * 
 * @param {css.Node} node
 * @returns Whether the node can be a css.Rule
 */
function isRule(node: css.Rule | css.AtRule | css.Comment): node is css.Rule {
  // could still be Page AtRule 
  return node && node.type === 'rule';
}

/**
 * Checks whether a node parsed by @reworkcss/css is a css declaration
 * 
 * @param {css.Node} node
 * @returns Whether the node can be a css.Declaration
 */
function isDeclaration(node: css.Rule | css.Declaration): node is css.Declaration {
  return node && node.type === 'declaration';
}

/**
 * Checks whether a declaration parsed by @reworkcss/css is a css variable
 * 
 * @param {css.Declaration} declaration
 * @returns Whether the declaration is a variable
 */
function isVariable(declaration: css.Declaration) {
  return declaration.property?.startsWith('--');
}

/**
 * Iterates over a stylesheet's nodes to find all variables within the provided selector's scope
 * 
 * @param {css.Stylesheet} stylesheet
 * @param {string} [selector] Css selector to look for variables in. Has to be exact
 * @returns A map of variables to their values
 */
function getVariablesFromStylesheet(stylesheet: css.Stylesheet, selector: string | undefined): VariableDict {
    let res: VariableDict = {};
    for (const node of stylesheet.stylesheet!.rules) {
        if (isRule(node) && (
            !selector || node.selectors && node.selectors.length === 1 && node.selectors.includes(selector)
        )) {
            for (const declaration of (node.declarations || [])) {
                if (
                    isDeclaration(declaration) && 
                    declaration.property && 
                    isVariable(declaration)
                ) {
                    const { property, value } = declaration;
                    if (property && value) res[property] = value;
                }
            }
        }
    }

    return res;
}

/**
 * Parses strings as css stylesheets to create a reference for their absolute/resolved string values
 * 
 * @param {string[]} content List of strings, in order, to parse for variables
 * @param {string} [selector=':root'] A selector to scope the search for variables 
 * @returns {{resolved: VariableDict, failed: string[]}} Resolved variables with absolute values + a list of the variables that failed to be resolved.
 */
export default function resolveCssVariables(content: string[], selector: string=':root'): { raw: VariableDict, resolved: VariableDict, failed: string[] } {
    const rawVariables = content.reduce((previous: VariableDict, contents: string) => ({ ...previous, ...getVariablesFromStylesheet(css.parse(contents), selector)}), {});
    const resolved : VariableDict = {};
    const failed: VariableDict<true> = {};
    const parsedVariables: Record<string, (ParsedVariable | ParsedLiteral)[]> = {};
    for (const variable in rawVariables) {
      parsedVariables[variable] = parseString(rawVariables[variable]);
      if (parsedVariables[variable].length === 1 && parsedVariables[variable][0].type === 'literal') {
        resolved[variable] = (parsedVariables[variable][0] as ParsedLiteral).value;
      }
    }

    for (const variable in parsedVariables) {
      const res = resolveFromLookups(parsedVariables[variable], resolved, parsedVariables, failed);
      if (res) {
        resolved[variable] = res;
      } else {
        failed[variable] = true;
      }
    }

    for (const variable in resolved) {
      // we do this here for the side-effect definitions from resolveFromLookups
      // which we should definitely refactor out in the future
      resolved[variable] = calc(resolved[variable]);
    }

    return {
        raw: rawVariables,
        resolved,
        failed: Object.keys(failed)
    }
}

// console.log(resolveCssVariables([
//     `
//       :root {
//           --bop: black;
//           --boop: var(--bop) o;
//           --bash: throw me a var(--basher, var(--bang, var(--nope, nope)));
//           --bang: var(--goop, loop);
//           --geek: var(--nonexistent);

//           --calculated: calc(var(--one) + calc(var(--two) * 2));
//           --one: 1px;
//           --two: 1rem;
//       }
//     `
// ]));

// console.log(resolveCssVariables([
//   `
//   :root {
// 	  --theme-color: var(--light, white);
// 	}
//   `
// ]))