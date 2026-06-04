module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-.*|@react-native-.*|uuid|react-native-nitro-sound|react-native-nitro-modules)/)',
  ],
  moduleNameMapper: {
    '^react-dom$': '<rootDir>/__mocks__/react-dom.js',
    '^react-native-bootsplash$': '<rootDir>/__mocks__/react-native-bootsplash.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
    '^react-native-vision-camera$': '<rootDir>/__mocks__/react-native-vision-camera.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/lib/module/jest/AsyncStorageMock.js',
    '^@op-engineering/op-sqlite$': '<rootDir>/__mocks__/@op-engineering/op-sqlite.js',
    '^react-native-nitro-sound$': '<rootDir>/__mocks__/react-native-nitro-sound.js',
  },
};
