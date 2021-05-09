import test from 'ava';
import resolveCssVariables from './index.js';

test('Returns variables scoped to root', t => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}
	`]);
	t.deepEqual(variables.resolved, { '--dark': 'black' });
});