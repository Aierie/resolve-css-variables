/**
 * reduce-css-calc doesn't have types right now
 */
declare module 'reduce-css-calc' {
    const calc: (value: string) => string;
    export default calc;
}