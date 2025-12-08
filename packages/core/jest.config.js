module.exports = {
  preset: 'react-native',
  testEnvironment: './jest.node.env.js',
  modulePathIgnorePatterns: [
    '<rootDir>/../../example/node_modules',
    '<rootDir>/lib/',
  ],
};
