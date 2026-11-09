const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidAdaptiveLayout(config) {
  return withAndroidManifest(config, (result) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(result.modResults);
    // Override the shared portrait setting only on Android; iOS remains unchanged.
    delete activity.$['android:screenOrientation'];
    delete activity.$['android:minAspectRatio'];
    delete activity.$['android:maxAspectRatio'];
    activity.$['android:resizeableActivity'] = 'true';
    return result;
  });
};
