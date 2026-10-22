const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withFirebaseNotificationManifest(config) {
  return withAndroidManifest(config, (config) => {
    const notificationsPlugin = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    );
    const notificationsOptions = notificationsPlugin?.[1];
    if (!notificationsOptions?.defaultChannel || !notificationsOptions.color) {
      throw new Error(
        'Firebase notification manifest configuration requires expo-notifications defaultChannel and color.',
      );
    }

    config.modResults.manifest.$['xmlns:tools'] ??=
      'http://schemas.android.com/tools';
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Android manifest is missing its application element.');
    }

    application['meta-data'] ??= [];
    const notificationMetadata = [
      [
        'com.google.firebase.messaging.default_notification_channel_id',
        'android:value',
        notificationsOptions.defaultChannel,
      ],
      [
        'com.google.firebase.messaging.default_notification_color',
        'android:resource',
        '@color/notification_icon_color',
      ],
    ];

    for (const [name, attribute, value] of notificationMetadata) {
      let metadata = application['meta-data'].find(
        (item) => item.$?.['android:name'] === name,
      );
      if (!metadata) {
        metadata = { $: { 'android:name': name } };
        application['meta-data'].push(metadata);
      }
      metadata.$[attribute] = value;
      metadata.$['tools:replace'] = attribute;
    }

    return config;
  });
};
