const regexes = {
  literal: /^.+?(?=var\(--.+?\)|$)/,
  variable: /^var\(--.+?(?<!\\)\)/,
  remainingBracket: /^\s*\)/,
  varStartGlobal: /var\(--/g, // don't use this for test since lastIndex will move
  varStart: /var\(--/,
  variableName: /(?<=var\()(--.+?)(?=(,|\)))/,
}

export interface ParsedLiteral {
  value: string
  type: 'literal'
}

export interface ParsedVariable {
  type: 'variable'
  rawValue: string
  variableName: string
  fallback: ParsedVariable | ParsedLiteral | null
}

function parseVariable(readVariable: string): ParsedVariable {
  let res: Record<string, any> = {
    type: 'variable',
    rawValue: readVariable,
  };

  let variable = readVariable.match(regexes.variableName)?.[0]!.trim();
  const fallback = readVariable.match(new RegExp(`(?<=^var\\(\\s*${variable}\\s*,\\s*)(.+?)(?=\\)$)`))?.[0]?.trim();

  res.variableName = variable;

  if (fallback !== undefined && fallback !== null) {
    if (regexes.varStart.test(fallback)) {
      res.fallback = parseVariable(fallback);
    } else {
      res.fallback = {
        value: fallback,
        type: 'literal'
      } as ParsedLiteral
    }
  } else {
    res.fallback = null;
  }

  return res as ParsedVariable;
}

export function parseString(value: string) : (ParsedLiteral | ParsedVariable)[] {
  let res = [];
  let unparsed = value;
  let currentlyMatching = 'variable';

  while (unparsed.length) {
    if (currentlyMatching === 'variable') {
      let match = unparsed.match(regexes.variable);
      if (match) {
        let matchedValue: string = match[0];
        let varsWithinMatchedValue = (matchedValue.match(regexes.varStartGlobal)?.length)!;
        if (varsWithinMatchedValue > 1) {
            // - 1 because we should already have one closing bracket
            for (let i=0; i < varsWithinMatchedValue - 1; i++) {
              let temp = unparsed.slice(matchedValue.length);
              let remainingBracket = temp.match(regexes.remainingBracket)?.[0];
  
              // not handling missing remaining bracket.
              // not having a remaining bracket means invalid css
              if (!remainingBracket) {
                throw new Error(`Resolving css variables - parsed string "${matchedValue}" is missing a closing bracket`);
              }
  
              matchedValue += remainingBracket;
            }
        }

        res.push(
          parseVariable(matchedValue)
        );
        
        unparsed = unparsed.slice(matchedValue.length);
      }
      currentlyMatching = 'literal';
    } else if (currentlyMatching === 'literal') {
      let match = unparsed.match(regexes.literal);
      if (match) {
        let matchedValue = match[0];
        res.push(
          { 
            value: matchedValue, 
            type: 'literal'
          } as ParsedLiteral
        );
        unparsed = unparsed.slice(matchedValue.length);
      }
      currentlyMatching = 'variable';
    }
  }

  return res;
}

export function resolveFromLookups(parsed: (ParsedLiteral|ParsedVariable)[], lookup: Record<string, string>, remainingVariables: Record<string, (ParsedVariable|ParsedLiteral)[]>, failed: Record<string, true>){
  const _resolve = (o: ParsedVariable): string | undefined => {
    if (lookup[o.variableName]) {
      return lookup[o.variableName];
    } else {
      if (remainingVariables[o.variableName]) {
        let resolved = resolveFromLookups(remainingVariables[o.variableName], lookup, remainingVariables, failed);
        if (resolved) {
          lookup[o.variableName] = resolved; 
          return resolved;
        } else {
          failed[o.variableName] = true;
        }
      } else {
        failed[o.variableName] = true;
      }

      if (o.fallback) {
        if (o.fallback.type === 'variable') return _resolve(o.fallback);
        else return o.fallback.value;
      } 
    }
  }
  let res = '';
  for (let o of parsed) {
    if (o.type === 'literal') {
      res += o.value;
    } else if (o.type === 'variable') {
      let resolved = _resolve(o);
      if (resolved === undefined || res === null) {
        return undefined;
      } else {
        res += resolved;
      }
    }
  }
  return res;
}
