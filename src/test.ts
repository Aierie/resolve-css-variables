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

test("Returns failed, an array with variables it couldn\'t resolve", t => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	:root {
	  --theme-color: var(--light);
	}
	`], ':root');
	t.deepEqual(variables.failed.length, 2);
	t.true(variables.failed.includes('--light'));
	t.true(variables.failed.includes('--theme-color'));
});

test("It replaces a single variable with its fallback correctly", t => {
	const variables = resolveCssVariables([`
	:root {
	  --theme-color: var(--light, white);
	}
	`], ':root');
	t.deepEqual(variables.resolved['--theme-color'], 'white');
});

test("It replaces a nested variable with the resolved value when resolvable", t => {
	const variables = resolveCssVariables([`
	:root {
	  --theme-color: var( --light , var(--whitish, #fffffe));
	  --whitish: snow;

	  --theme-background: var(--dark, var( --darkish));
	  --darkish: var(--black, #000);
	}
	`], ':root');
	t.deepEqual(variables.resolved['--theme-color'], 'snow');
	t.deepEqual(variables.resolved['--theme-background'], '#000');
})

test("It replaces a nested variable with its fallback when unresolvable", t => {
	const variables = resolveCssVariables([`
	:root {
	  --theme-color: var(--light, var(--whitish, #fffffe));
	}
	`], ':root');
	t.deepEqual(variables.resolved['--theme-color'], '#fffffe');
});