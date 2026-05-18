module.exports = {
  hide: jest.fn().mockResolvedValue(),
  isVisible: jest.fn(),
  useHideAnimation: jest.fn().mockReturnValue({
    container: {},
    logo: { source: 0 },
  }),
};
