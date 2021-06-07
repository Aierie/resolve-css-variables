import calc from 'reduce-css-calc';
import css from 'css';

import { parseString, resolveFromLookups } from './parse';
import { Node } from 'postcss-value-parser';

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
function getVariablesFromStylesheet(stylesheet: css.Stylesheet, selector: string | undefined): Record<string, string> {
    let res: Record<string, string> = {};
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
 * @returns {{resolved: Record<string, string>, failed: string[]}} Resolved variables with absolute values + a list of the variables that failed to be resolved.
 */
export default function resolveCssVariables(content: string[], selector: string=':root'): { raw: Record<string, string>, resolved: Record<string, string>, failed: string[] } {
    const rawVariables = content.reduce((previous: Record<string, string>, contents: string) => ({ ...previous, ...getVariablesFromStylesheet(css.parse(contents), selector)}), {});
    const resolved : Record<string, string> = {};
    const failed: Record<string, true> = {};
    const parsedVariables: Record<string, Node[]> = {};
    for (const variable in rawVariables) {
      parsedVariables[variable] = parseString(rawVariables[variable]);
    }

    for (const variable in parsedVariables) {
      resolveFromLookups(parsedVariables, resolved, failed, variable);
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
