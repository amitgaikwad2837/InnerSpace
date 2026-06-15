const baseConfig = require('./app.json');

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    extra: {
      ...baseConfig.expo.extra,
      // Set GOOGLE_WEB_CLIENT_ID in your environment or .env file.
      // See .env.example for the required format.
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
    },
  },
};
