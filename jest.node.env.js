const NodeEnvironment = require('jest-environment-node');
const BaseEnvironment =
  (NodeEnvironment && NodeEnvironment.default) || NodeEnvironment;

class SafeNodeEnvironment extends BaseEnvironment {
  constructor(config, context) {
    const safeConfig = {
      ...(config ?? {}),
      projectConfig: {
        testEnvironmentOptions: {},
        ...(config && config.projectConfig ? config.projectConfig : {}),
      },
      globalConfig: config && config.globalConfig ? config.globalConfig : {},
    };
    super(safeConfig, context);
  }
}

module.exports = SafeNodeEnvironment;
