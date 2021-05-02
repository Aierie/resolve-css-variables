import calc from 'reduce-css-calc';
import css from 'css';

/**
 * A POJO that maps css variables to values
 */
interface VariableDict<T=string> {
  [variable: string]: T
}

/**
 * Checks whether a node parsed by @reworckss/css is a css rule
 * 
 * @param {css.Node} node
 * @returns Whether the node can be a css.Rule
 */
function isRule(node: css.Rule | css.AtRule | css.Comment): node is css.Rule {
  // could still be Page AtRule 
  return node && node.type === 'rule';
}

/**
 * Checks whether a node parsed by @reworckss/css is a css declaration
 * 
 * @param {css.Node} node
 * @returns Whether the node can be a css.Declaration
 */
function isDeclaration(node: css.Rule | css.Declaration): node is css.Declaration {
  return node && node.type === 'declaration';
}

/**
 * Checks whether a declaration parsed by @reworckss/css is a css variable
 * 
 * @param {css.Declaration} declaration
 * @returns Whether the declaration is a variable
 */
function isVariable(declaration: css.Declaration) {
  return declaration.property?.startsWith('--');
}

/**
 * Replaces variable reads within the string with static values if found within the provided lookup
 * 
 * @param {VariableDict} lookup 
 * @param {string} value The value to carry out replacement on
 * @param {string[]} dependencies The variables that are read in this value
 * @returns The value with its dependencies replaced
 */
function replaceVariables(lookup: VariableDict, value: string, dependencies: string[]): string {
    let res = value;
    for (const dependency of dependencies) {
        const dependencyValue = lookup[dependency];
        if (dependencyValue) {
            // maybe should add a step to remove spaces at the beginning
            // instead of trying to handle this at this step
            const regex = new RegExp('var\\(\\s*' + dependency + '\\s*\\)', 'g');
            res = res.replace(regex, dependencyValue);
        }
    }
    return res;
}

/**
 * Finds all css variables read in a string
 * 
 * @param {string} value
 * @returns An array of css variables that were read within this string
 */
function variablesInValue(value: string): string[] {
    return value.match(/(?<=var\()(--.+?)(?=\))/g) || [];
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
 * Looks for variables that are read within the VariableDict's values but do not exist within the VariableDict
 * 
 * @param {VariableDict} variables
 * @returns Variables that don't exist as a VariableDict<true> for easier lookup
 */
function getUnresolvedNames(variables: VariableDict): VariableDict<true> {
    const res: VariableDict<true> = {}
    for (const variable in variables) {
        const value = variables[variable];
        const dependencies = variablesInValue(value);
        for (const dependency of dependencies) {
            if (!variables[dependency]) res[dependency] = true;
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
export default function resolveVariables(content: string[], selector: string=':root'): { resolved: VariableDict, failed: string[] } {
    const rawVariables = content.reduce((previous: VariableDict, contents: string) => ({ ...previous, ...getVariablesFromStylesheet(css.parse(contents), selector)}), {});
    const copy = (value: Object) => JSON.parse(JSON.stringify(value));
    const resolved : VariableDict = {};

    /**
     * Some inefficiency in iteration here - see the unresolved/nextUnresolved interactions w the loops
     */
    let failed: VariableDict<true> = getUnresolvedNames(rawVariables);
    let unresolved : VariableDict = copy(rawVariables);
    let nextUnresolved : VariableDict = {};
    while (Object.keys(unresolved).length) {
        for (const variable in unresolved) {
            if (failed[variable]) {
                continue;
            }

            const value = unresolved[variable];
            if (!value) {
                failed[variable] = true;
            } else {
                const dependsOnVariables = variablesInValue(value);
                if (dependsOnVariables?.length) {
                    if (dependsOnVariables.some(variable => failed[variable])) {
                        failed[variable] = true;
                        continue;
                    }

                    nextUnresolved[variable] = replaceVariables(resolved, value, dependsOnVariables);
                } else {
                    resolved[variable] = calc(value);
                }
            }
        }
        unresolved = copy(nextUnresolved);
        nextUnresolved = {};
    }

    return {
        resolved,
        failed: Object.keys(failed)
    }
}
