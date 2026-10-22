const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withAndroidReleaseOptimization(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') {
      throw new Error('Android release optimization requires the Expo Groovy app build.gradle.');
    }

    const defaultRules = /getDefaultProguardFile\((['"])proguard-android(?:-optimize)?\.txt\1\)/g;
    if (!defaultRules.test(result.modResults.contents)) {
      throw new Error('Android release optimization could not find the default ProGuard configuration.');
    }

    // Expo's non-optimizing default includes -dontoptimize even when R8 is enabled.
    result.modResults.contents = result.modResults.contents.replace(
      defaultRules,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    return result;
  });
};
