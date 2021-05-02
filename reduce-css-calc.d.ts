/**
 * reduce-css-calc doesn't have types right now
 */
declare module 'reduce-css-calc' {
    export default calc = (value: string) => string;
}