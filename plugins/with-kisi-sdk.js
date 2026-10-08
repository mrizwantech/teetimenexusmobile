const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = function withKisiSdk(config) {
  return withProjectBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') {
      throw new Error('Kisi SDK configuration requires the Expo Groovy root build.gradle.');
    }
    if (!result.modResults.contents.includes('// Tee Time Nexus Kisi SDK repository')) {
      result.modResults.contents += `
// Tee Time Nexus Kisi SDK repository
allprojects {
    repositories {
        maven {
            url uri(new File(rootProject.projectDir, "../modules/kisi-access/android/vendor"))
            content { includeGroup "de.kisi" }
        }
    }
}
`;
    }
    return result;
  });
};
