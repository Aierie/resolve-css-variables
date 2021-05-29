import resolveCssVariables from './index';

test('Returns variables for provided scope only', () => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	.not-root {
	  --light: white;
	}
	`], '.not-root');
	expect(variables.resolved).toEqual({ '--light': 'white' });
});

test('Ignores comments', () => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black; /* should not see this */
	  --blue: blue/* or this */;
	}
	`], ':root');
	expect(variables.resolved).toEqual({ '--dark': 'black', '--blue': 'blue' });
});

test('Returns variables for :root if scope not provided', () => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	.not-root {
	  --light: white;
	}
	`], ':root');
	expect(variables.resolved).toEqual({ '--dark': 'black' });
});

test('Returns values for variables that reference variables', () => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	:root {
	  --theme-color: var(--dark);
	}
	`], ':root');
	expect(variables.resolved).toEqual({ '--dark': 'black', '--theme-color': 'black' });
});

test("Returns failed, an array with variables it couldn\'t resolve", () => {
	const variables = resolveCssVariables([`
	:root {
	  --dark: black;
	}

	:root {
	  --theme-color: var(--light);
	}
	`], ':root');

	expect(variables.failed.length).toEqual(2);
	expect(variables.failed).toContain('--light');
	expect(variables.failed).toContain('--theme-color');
});

test("It replaces a single variable with its fallback correctly", () => {
	const variables = resolveCssVariables([`
	:root {
	  --theme-color: var(--light, white);
	}
	`], ':root');
	expect(variables.resolved['--theme-color']).toEqual('white');
});

test("It replaces a nested variable with the resolved value when resolvable", () => {
	const variables = resolveCssVariables([`
	:root {
	  --theme-color: var( --light , var(--whitish, #fffffe));
	  --whitish: snow;

	  --theme-background: var(--dark, var( --darkish));
	  --darkish: var(--black, #000);
	}
	`], ':root');
	expect(variables.resolved['--theme-color']).toEqual('snow');
	expect(variables.resolved['--theme-background']).toEqual('#000');
})

test("It replaces a nested variable with its fallback when unresolvable", () => {
	const variables = resolveCssVariables([`
	:root {
	  --theme-color: var(--light, var(--whitish, #fffffe));
	}
	`], ':root');
	expect(variables.resolved['--theme-color']).toEqual('#fffffe');
});

test("It can resolve values using css functions", () => {
	const variables = resolveCssVariables([`
	:root {
	  --background-color: rgba(0, 0, 0, var(--opacity));
	  --opacity: 0.5;

	  --theme-color: var(--nonexistent-color, rgb(242, var(--green), 22));
	  --green: 45;
	}
	`], ':root');
	expect(variables.resolved['--background-color']).toEqual('rgba(0, 0, 0, 0.5)');
	expect(variables.resolved['--theme-color']).toEqual('rgb(242, 45, 22)');
});

test("It reduces nested calc", () => {
	const variables = resolveCssVariables([`
	:root {
	  --width: calc(calc(var(--factor) * 4px) + 2rem);
	  --factor: 0.5;
	}
	`], ':root');
	expect(variables.resolved['--width']).toEqual('calc(2px + 2rem)');
});