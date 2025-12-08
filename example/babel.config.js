const path = require('path');
const analytics = require('../packages/core/package.json');
const firebase = require('../packages/analytics-firebase/package.json');
const mixpanel = require('../packages/analytics-mixpanel/package.json');

module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          [analytics.name]: path.join(__dirname, '..', 'packages', 'core', analytics.source),
          [firebase.name]: path.join(
            __dirname,
            '..',
            'packages',
            'analytics-firebase',
            firebase.source
          ),
          [mixpanel.name]: path.join(
            __dirname,
            '..',
            'packages',
            'analytics-mixpanel',
            mixpanel.source
          ),
        },
      },
    ],
  ],
};
