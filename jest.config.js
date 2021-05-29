export default {
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  testEnvironment: 'jsdom',
  testRegex: '/src/.*\\.test?\\.ts$',
  moduleFileExtensions: ['ts', 'js']
};