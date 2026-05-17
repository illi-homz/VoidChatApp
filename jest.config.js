module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-.*|@react-native-.*|uuid)/)',
  ],
  moduleNameMapper: {
    '^react-dom$': '<rootDir>/__mocks__/react-dom.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/lib/module/jest/AsyncStorageMock.js',
  },
};
