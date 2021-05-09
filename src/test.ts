import test from 'ava';
import resolveCssVariables from './index.js';

test('Returns variables for provided scope only', t => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	.not-root {
	  --light: white;
	}
	`], '.not-root');
	t.deepEqual(variables.resolved, { '--light': 'white' });
});

test('Returns variables for :root if scope not provided', t => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	.not-root {
	  --light: white;
	}
	`], ':root');
	t.deepEqual(variables.resolved, { '--dark': 'black' });
});

test('Returns values for variables thta reference variables', t => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	:root {
	  --theme-color: var(--dark);
	}
	`], ':root');
	t.deepEqual(variables.resolved, { '--dark': 'black', '--theme-color': 'black' });
});

test("Returns an array with variables it couldn\'t resolve", t => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	:root {
	  --theme-color: var(--light);
	}
	`], ':root');
	t.true(variables.failed.includes('--light'));
	t.true(variables.failed.includes('--theme-color'));
});