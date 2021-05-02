import calc from 'reduce-css-calc';
import css from 'css';

const readVariableRegex = /(?<=var\()(--.+?)(?=\))/g;

function replaceVariables(resolved: { [variable:string]: string }, value: string, dependencies: string[]){
    let res = value;
    for (const dependency of dependencies) {
        const resolvedValue = resolved[dependency];
        if (resolvedValue) {
            // maybe should add a step to remove spaces at the beginning
            // instead of trying to handle this at this step
            const regex = new RegExp('var\\(\\s*' + dependency + '\\s*\\)', 'g');
            res = res.replace(regex, resolvedValue);
        }
    }

    return res;
}

function variablesInValue(value: string){
    return value.match(readVariableRegex);
}

function isRule(node: css.Rule | css.AtRule | css.Comment): node is css.Rule {
  // could still be Page AtRule 
  return node && node.type === 'rule';
}

function isDeclaration(node: css.Rule | css.Declaration): node is css.Declaration {
  return node && node.type === 'declaration';
}

function isVariable(declaration: css.Declaration) {
  return declaration.property?.startsWith('--');
}

function getVariablesFromStylesheet(stylesheet: css.Stylesheet, selector: string | undefined){
    let res: { [variable: string]: string } = {};
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

function getUnresolvedNames(rawVariables: { [variable: string]: string }){
    const res: { [variable: string]: true } = {}
    for (const variable in rawVariables) {
        const value = rawVariables[variable];
        const dependencies = variablesInValue(value);
        if (!dependencies) continue;
        for (const dependency of dependencies) {
            if (!rawVariables[dependency]) res[dependency] = true;
        }
    }
    return res;
}

export default function resolveVariables(content: string[], filter: (variable: string, value: string) => boolean, selector: string=':root') {
    const rawVariables = content.reduce((previous: { [variable: string]: string }, contents: string) => ({ ...previous, ...getVariablesFromStylesheet(css.parse(contents), selector)}), {});
    const copy = (value: Object) => JSON.parse(JSON.stringify(value));
    const resolved : {[variable:string]: string} = {};
    const dependencies  : {[variable:string]: string[]} = {};

    let failed: {[variable: string]: true} = getUnresolvedNames(rawVariables);
    let unresolved : {[variable:string]: string} = copy(rawVariables);
    let nextUnresolved : {[variable:string]: string} = {};
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

                    dependencies[variable] = dependsOnVariables;
                    nextUnresolved[variable] = replaceVariables(resolved, value, dependsOnVariables);
                } else {
                    resolved[variable] = value;
                }
            }
        }
        unresolved = copy(nextUnresolved);
        console.log(Object.keys(unresolved));
        nextUnresolved = {};
    }

    for (const variable in resolved) {
        const value = resolved[variable];
        if (filter && !filter(variable, value)) {
            delete resolved[variable];
            failed[variable] = true;
            continue;
        }
        resolved[variable] = calc(resolved[variable]);
    }

    return {
        resolved,
        failed: Object.keys(failed)
    }
}

const variableDeclaration1 = `
:root {
    --boxel-red: #ff0000;
    --boxel-blue: blue;
    --references-boxel-blue: var(--boxel-blue);
    --silly: silly;
    --putty: putty;
    --silly-putty: var(--silly) var(--putty);
    --silly-putty-silly-putty: var(--silly-putty) var(--silly-putty) var(--snoop);
    --calc-one: calc(5 * 5px);
    --calc-two: calc(var(--calc-one) * 3);
    color: black;
}

.boop {
    --boxel-boop: boop;
}

.beep .boop {
    --boxel-beep-boop: boopbeep;
}

/* haha a comment */

.beep.boop  {
    --boxel-beep-boop: boopbeep;
}
`

const variableDeclaration2 = `
:root {
    --boxel-sp-1: 1px;
    --boxel-sp-2: 2px;
    --boxel-shadow: 1px solid var(--boxel-blue);
    --boxel-reference-shadow: 1px solid var(--references-boxel-blue);
}
`;

console.log(resolveVariables([variableDeclaration1, variableDeclaration2], (variable: string, value: string) => { return variable.startsWith('--b') }, ':root'));