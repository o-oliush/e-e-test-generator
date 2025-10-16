const { extractVideoFrames } = require('./videoFrameExtractor');

describe('extractVideoFrames', () => {
  it('throws when inputPath is missing', async () => {
    await expect(extractVideoFrames()).rejects.toThrow(/inputPath is required/);
  });

  it('throws when frameIntervalMs is not positive', async () => {
    await expect(
      extractVideoFrames({ inputPath: '/tmp/video.mp4', frameIntervalMs: 0 })
    ).rejects.toThrow(/frameIntervalMs must be a positive number/);
  });
});
